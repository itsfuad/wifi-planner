import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Label, Layer, Line, Rect, Stage, Tag, Text, Transformer } from 'react-konva';
import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { PlanContext } from '../model/PlanContext';
import type { Door, FloorPlan, Obstacle, Point, Router, Wall } from '../model/types';
import { BackhaulType, DoorType, ObstacleType, RouterMode, WallMaterial } from '../model/types';
import type { SimulationResponse } from '../sim/worker';
import { distance, getNearestPointOnSegment } from '../utils/math';
import { calculateBackhaulRSSI, getSignalQualityColor } from '../utils/signal';
import { Heatmap } from './Heatmap';
import { useUI } from './UIContext';

type Box = { x: number; y: number; width: number; height: number };
type DragSession = { start: Point; ids: Set<string>; primaryId: string; moved: boolean };

interface EditorCanvasProps {
  simulationResult?: SimulationResponse | null;
}

const boxesIntersect = (a: Box, b: Box) =>
  a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;

const normalizeBox = (box: Box): Box => ({
  x: box.width < 0 ? box.x + box.width : box.x,
  y: box.height < 0 ? box.y + box.height : box.y,
  width: Math.abs(box.width),
  height: Math.abs(box.height),
});

const pointKey = (p: Point) => `${p.x},${p.y}`;

const obstacleBounds = (obs: Obstacle): Box => {
  if (!obs.rotation) return { x: obs.x, y: obs.y, width: obs.width, height: obs.height };
  const r = obs.rotation * Math.PI / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const pts = [
    { x: 0, y: 0 },
    { x: obs.width, y: 0 },
    { x: obs.width, y: obs.height },
    { x: 0, y: obs.height },
  ].map((p) => ({ x: obs.x + p.x * c - p.y * s, y: obs.y + p.x * s + p.y * c }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const wallBounds = (wall: Wall): Box => {
  const pad = Math.max(8, wall.thickness / 2 + 4);
  const x = Math.min(wall.p1.x, wall.p2.x) - pad;
  const y = Math.min(wall.p1.y, wall.p2.y) - pad;
  return {
    x,
    y,
    width: Math.abs(wall.p2.x - wall.p1.x) + pad * 2,
    height: Math.abs(wall.p2.y - wall.p1.y) + pad * 2,
  };
};

const routerBounds = (router: Router): Box => ({ x: router.x - 24, y: router.y - 24, width: 48, height: 58 });

const doorCenter = (door: Door, wall: Wall): Point => {
  const len = distance(wall.p1, wall.p2) || 1;
  const ux = (wall.p2.x - wall.p1.x) / len;
  const uy = (wall.p2.y - wall.p1.y) / len;
  return { x: wall.p1.x + ux * door.distance, y: wall.p1.y + uy * door.distance };
};

const doorBounds = (door: Door, wall: Wall): Box => {
  const center = doorCenter(door, wall);
  const len = distance(wall.p1, wall.p2) || 1;
  const ux = (wall.p2.x - wall.p1.x) / len;
  const uy = (wall.p2.y - wall.p1.y) / len;
  const half = door.width / 2;
  const p1 = { x: center.x - ux * half, y: center.y - uy * half };
  const p2 = { x: center.x + ux * half, y: center.y + uy * half };
  const pad = Math.max(10, wall.thickness / 2 + 4);
  return {
    x: Math.min(p1.x, p2.x) - pad,
    y: Math.min(p1.y, p2.y) - pad,
    width: Math.abs(p2.x - p1.x) + pad * 2,
    height: Math.abs(p2.y - p1.y) + pad * 2,
  };
};

const allEntityIds = (plan: FloorPlan) => [
  ...plan.walls.map((x) => x.id),
  ...plan.doors.map((x) => x.id),
  ...plan.obstacles.map((x) => x.id),
  ...plan.routers.map((x) => x.id),
];

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ simulationResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const lastFitPlanId = useRef<string | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [selectionBox, setSelectionBox] = useState<Box | null>(null);
  const [selectionAdditive, setSelectionAdditive] = useState(false);
  const [dragDelta, setDragDelta] = useState<Point>({ x: 0, y: 0 });
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [doorPreviewPos, setDoorPreviewPos] = useState<Point | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const { plan, dispatch } = useContext(PlanContext);
  const {
    activeTool, setActiveTool, gridSize, selectedIds, setSelectedIds, clearSelection,
    scale, setScale, showGrid, showHeatmap, heatmapOpacity,
  } = useUI();

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      setSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const snapToGrid = useCallback((value: number) => Math.round(value / gridSize) * gridSize, [gridSize]);

  const getStagePointerPosition = useCallback((stage: Konva.Stage): Point | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const stageScale = stage.scaleX();
    return { x: (pointer.x - stage.x()) / stageScale, y: (pointer.y - stage.y()) / stageScale };
  }, []);

  const snapToWallEndpoint = useCallback((pos: Point) => {
    const threshold = Math.max(14, 18 / Math.max(scale, .25));
    let closest: Point | null = null;
    let minDistance = Infinity;
    plan.walls.forEach((wall) => {
      [wall.p1, wall.p2].forEach((point) => {
        const d = distance(point, pos);
        if (d < threshold && d < minDistance) {
          minDistance = d;
          closest = point;
        }
      });
    });
    return closest ?? { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
  }, [plan.walls, scale, snapToGrid]);

  const getEntityAnchor = useCallback((id: string): Point | null => {
    const wall = plan.walls.find((x) => x.id === id);
    if (wall) return wall.p1;
    const obs = plan.obstacles.find((x) => x.id === id);
    if (obs) return { x: obs.x, y: obs.y };
    const router = plan.routers.find((x) => x.id === id);
    if (router) return { x: router.x, y: router.y };
    const door = plan.doors.find((x) => x.id === id);
    if (door) {
      const parent = plan.walls.find((x) => x.id === door.wallId);
      if (parent) return doorCenter(door, parent);
    }
    return null;
  }, [plan]);

  const snapDragDelta = useCallback((session: DragSession, delta: Point) => {
    const anchor = getEntityAnchor(session.primaryId);
    if (!anchor) return delta;
    return {
      x: snapToGrid(anchor.x + delta.x) - anchor.x,
      y: snapToGrid(anchor.y + delta.y) - anchor.y,
    };
  }, [getEntityAnchor, snapToGrid]);

  const selectedWallEndpointKeys = useMemo(() => {
    const keys = new Set<string>();
    const ids = dragSessionRef.current?.ids ?? selectedIds;
    plan.walls.forEach((wall) => {
      if (!ids.has(wall.id)) return;
      keys.add(pointKey(wall.p1));
      keys.add(pointKey(wall.p2));
    });
    return keys;
  }, [plan.walls, selectedIds, dragDelta]);

  const activeDragIds = dragSessionRef.current?.ids ?? new Set<string>();

  const previewWall = useCallback((wall: Wall): Wall => {
    if (!dragSessionRef.current || (!dragDelta.x && !dragDelta.y)) return wall;
    const move = (p: Point) => ({ x: p.x + dragDelta.x, y: p.y + dragDelta.y });
    if (activeDragIds.has(wall.id)) return { ...wall, p1: move(wall.p1), p2: move(wall.p2) };
    const p1 = selectedWallEndpointKeys.has(pointKey(wall.p1)) ? move(wall.p1) : wall.p1;
    const p2 = selectedWallEndpointKeys.has(pointKey(wall.p2)) ? move(wall.p2) : wall.p2;
    return p1 === wall.p1 && p2 === wall.p2 ? wall : { ...wall, p1, p2 };
  }, [activeDragIds, dragDelta, selectedWallEndpointKeys]);

  const previewRouter = useCallback((router: Router): Router => {
    if (!activeDragIds.has(router.id)) return router;
    return { ...router, x: router.x + dragDelta.x, y: router.y + dragDelta.y };
  }, [activeDragIds, dragDelta]);

  const previewObstacle = useCallback((obs: Obstacle): Obstacle => {
    if (!activeDragIds.has(obs.id)) return obs;
    return { ...obs, x: obs.x + dragDelta.x, y: obs.y + dragDelta.y };
  }, [activeDragIds, dragDelta]);

  const previewDoor = useCallback((door: Door) => {
    const originalWall = plan.walls.find((x) => x.id === door.wallId);
    if (!originalWall) return null;
    const wall = previewWall(originalWall);
    let distanceAlong = door.distance;
    if (activeDragIds.has(door.id) && !activeDragIds.has(door.wallId)) {
      const len = distance(originalWall.p1, originalWall.p2) || 1;
      const ux = (originalWall.p2.x - originalWall.p1.x) / len;
      const uy = (originalWall.p2.y - originalWall.p1.y) / len;
      const projected = dragDelta.x * ux + dragDelta.y * uy;
      const half = door.width / 2;
      distanceAlong = Math.max(half, Math.min(len - half, door.distance + projected));
    }
    const len = distance(wall.p1, wall.p2) || 1;
    const ux = (wall.p2.x - wall.p1.x) / len;
    const uy = (wall.p2.y - wall.p1.y) / len;
    return {
      wall,
      distance: distanceAlong,
      x: wall.p1.x + ux * distanceAlong,
      y: wall.p1.y + uy * distanceAlong,
      angle: Math.atan2(uy, ux) * 180 / Math.PI,
    };
  }, [activeDragIds, dragDelta, plan.walls, previewWall]);

  const entityBounds = useCallback((id: string): Box | null => {
    const wall = plan.walls.find((x) => x.id === id);
    if (wall) return wallBounds(wall);
    const obs = plan.obstacles.find((x) => x.id === id);
    if (obs) return obstacleBounds(obs);
    const router = plan.routers.find((x) => x.id === id);
    if (router) return routerBounds(router);
    const door = plan.doors.find((x) => x.id === id);
    if (door) {
      const parent = plan.walls.find((x) => x.id === door.wallId);
      if (parent) return doorBounds(door, parent);
    }
    return null;
  }, [plan]);

  const selectionBounds = useMemo(() => {
    if (selectedIds.size < 2) return null;
    const boxes = [...selectedIds].map(entityBounds).filter((x): x is Box => !!x);
    if (!boxes.length) return null;
    const minX = Math.min(...boxes.map((x) => x.x));
    const minY = Math.min(...boxes.map((x) => x.y));
    const maxX = Math.max(...boxes.map((x) => x.x + x.width));
    const maxY = Math.max(...boxes.map((x) => x.y + x.height));
    const offset = dragSessionRef.current ? dragDelta : { x: 0, y: 0 };
    return { x: minX + offset.x, y: minY + offset.y, width: maxX - minX, height: maxY - minY };
  }, [dragDelta, entityBounds, selectedIds]);

  const beginEntityPointer = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'select') return;
    e.cancelBubble = true;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getStagePointerPosition(stage);
    if (!pos) return;
    const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    let next = new Set(selectedIds);

    if (additive) {
      if (next.has(id)) {
        next.delete(id);
        setSelectedIds(next);
        dragSessionRef.current = null;
        return;
      }
      next.add(id);
      setSelectedIds(next);
    } else if (!next.has(id)) {
      next = new Set([id]);
      setSelectedIds(next);
    }

    dragSessionRef.current = { start: pos, ids: next, primaryId: id, moved: false };
    setDragDelta({ x: 0, y: 0 });
  }, [activeTool, getStagePointerPosition, selectedIds, setSelectedIds]);

  const duplicateSelection = useCallback(() => {
    if (!selectedIds.size) return;
    const selected = new Set(selectedIds);
    const offset = gridSize;
    const wallIdMap = new Map<string, string>();
    const routerIdMap = new Map<string, string>();
    const newIds = new Set<string>();

    const newWalls = plan.walls.filter((w) => selected.has(w.id)).map((w) => {
      const id = uuidv4();
      wallIdMap.set(w.id, id);
      newIds.add(id);
      return { ...w, id, p1: { x: w.p1.x + offset, y: w.p1.y + offset }, p2: { x: w.p2.x + offset, y: w.p2.y + offset } };
    });
    const newObstacles = plan.obstacles.filter((o) => selected.has(o.id)).map((o) => {
      const id = uuidv4(); newIds.add(id);
      return { ...o, id, x: o.x + offset, y: o.y + offset };
    });
    const newRouters = plan.routers.filter((r) => selected.has(r.id)).map((r) => {
      const id = uuidv4(); routerIdMap.set(r.id, id); newIds.add(id);
      return { ...r, id, x: r.x + offset, y: r.y + offset };
    });
    const newDoors: Door[] = [];
    plan.doors.forEach((d) => {
      const clonedParent = wallIdMap.get(d.wallId);
      if (clonedParent) {
        const id = uuidv4(); newIds.add(id);
        newDoors.push({ ...d, id, wallId: clonedParent });
      } else if (selected.has(d.id)) {
        const wall = plan.walls.find((w) => w.id === d.wallId);
        const length = wall ? distance(wall.p1, wall.p2) : Infinity;
        const id = uuidv4(); newIds.add(id);
        newDoors.push({ ...d, id, distance: Math.min(length - d.width / 2, d.distance + offset) });
      }
    });
    const remappedRouters = newRouters.map((r) => r.meshParentId && routerIdMap.has(r.meshParentId)
      ? { ...r, meshParentId: routerIdMap.get(r.meshParentId)! }
      : r);

    dispatch({
      type: 'SET_PLAN',
      payload: {
        ...plan,
        walls: [...plan.walls, ...newWalls],
        doors: [...plan.doors, ...newDoors],
        obstacles: [...plan.obstacles, ...newObstacles],
        routers: [...plan.routers, ...remappedRouters],
      },
    });
    setSelectedIds(newIds);
  }, [dispatch, gridSize, plan, selectedIds, setSelectedIds]);

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.code === 'Space' && !editing) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (editing) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size) {
        e.preventDefault();
        dispatch({ type: 'DELETE_ENTITIES', payload: [...selectedIds] });
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(allEntityIds(plan)));
        setActiveTool('select');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.size) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (activeTool === 'select' && selectedIds.size && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const amount = e.shiftKey ? gridSize : 10;
        const dx = e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0;
        const dy = e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0;
        dispatch({ type: 'TRANSLATE_ENTITIES', payload: { ids: [...selectedIds], dx, dy } });
      }
    };
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [activeTool, clearSelection, dispatch, duplicateSelection, gridSize, plan, selectedIds, setActiveTool, setSelectedIds]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    if (selectedIds.size === 1) {
      const id = [...selectedIds][0];
      const obstacle = plan.obstacles.find((o) => o.id === id);
      const node = obstacle ? stage.findOne(`#${id}`) : null;
      transformer.nodes(node ? [node] : []);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [plan.obstacles, selectedIds]);

  const fitPlan = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !size.width || !size.height) return;
    const padX = 70;
    const padY = 80;
    const nextScale = Math.max(.2, Math.min(2, Math.min((size.width - padX * 2) / plan.width, (size.height - padY * 2) / plan.height)));
    setScale(nextScale);
    stage.position({
      x: (size.width - plan.width * nextScale) / 2,
      y: (size.height - plan.height * nextScale) / 2,
    });
    stage.batchDraw();
  }, [plan.height, plan.width, setScale, size.height, size.width]);

  const focusSelection = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !selectedIds.size) return;
    const boxes = [...selectedIds].map(entityBounds).filter((x): x is Box => !!x);
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((x) => x.x));
    const minY = Math.min(...boxes.map((x) => x.y));
    const maxX = Math.max(...boxes.map((x) => x.x + x.width));
    const maxY = Math.max(...boxes.map((x) => x.y + x.height));
    stage.position({
      x: size.width / 2 - ((minX + maxX) / 2) * scale,
      y: size.height / 2 - ((minY + maxY) / 2) * scale,
    });
    stage.batchDraw();
  }, [entityBounds, scale, selectedIds, size.height, size.width]);

  useEffect(() => {
    if (!size.width || !size.height || lastFitPlanId.current === plan.id) return;
    lastFitPlanId.current = plan.id;
    requestAnimationFrame(fitPlan);
  }, [fitPlan, plan.id, size.height, size.width]);

  const zoomAround = useCallback((nextScale: number, pointer?: Point) => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const clamped = Math.max(.2, Math.min(3, nextScale));
    const screenPoint = pointer ?? { x: size.width / 2, y: size.height / 2 };
    const world = { x: (screenPoint.x - stage.x()) / oldScale, y: (screenPoint.y - stage.y()) / oldScale };
    setScale(clamped);
    stage.position({ x: screenPoint.x - world.x * clamped, y: screenPoint.y - world.y * clamped });
    stage.batchDraw();
  }, [setScale, size.height, size.width]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY < 0 ? 1.08 : 1 / 1.08;
    zoomAround(stage.scaleX() * factor, pointer);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage || isSpacePressed) return;
    const pos = getStagePointerPosition(stage);
    if (!pos) return;
    const clickedOnEmpty = e.target === stage || e.target.hasName('bg');

    if (activeTool === 'select') {
      if (!clickedOnEmpty) return;
      const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      if (!additive) clearSelection();
      setSelectionAdditive(additive);
      setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    if (clickedOnEmpty) clearSelection();

    if (activeTool === 'router') {
      const id = uuidv4();
      const p = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
      dispatch({
        type: 'ADD_ROUTER',
        payload: {
          id, x: p.x, y: p.y, txPower: 20, band: 5, gain: 2,
          ssid: `AP-${plan.routers.length + 1}`, mode: RouterMode.Solo,
          meshParentId: null, backhaulType: BackhaulType.Wireless, backhaulBand: 5,
        },
      });
      setSelectedIds(new Set([id]));
      setActiveTool('select');
      return;
    }

    if (activeTool === 'door') {
      if (!hoveredWallId || !doorPreviewPos) return;
      const wall = plan.walls.find((w) => w.id === hoveredWallId);
      if (!wall) return;
      const id = uuidv4();
      dispatch({ type: 'ADD_DOOR', payload: { id, wallId: wall.id, distance: distance(wall.p1, doorPreviewPos), width: 80, type: DoorType.Wood } });
      setSelectedIds(new Set([id]));
      setActiveTool('select');
      setHoveredWallId(null);
      setDoorPreviewPos(null);
      return;
    }

    if (!['wall', 'obstacle', 'room'].includes(activeTool)) return;
    const snapped = activeTool === 'wall' ? snapToWallEndpoint(pos) : { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
    setIsDrawing(true);
    setStartPoint(snapped);
    setCurrentPoint(snapped);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getStagePointerPosition(stage);
    if (!pos) return;

    const dragSession = dragSessionRef.current;
    if (dragSession) {
      const dx = pos.x - dragSession.start.x;
      const dy = pos.y - dragSession.start.y;
      if (!dragSession.moved && Math.hypot(dx, dy) >= 3 / Math.max(scale, .25)) dragSession.moved = true;
      if (dragSession.moved) setDragDelta({ x: dx, y: dy });
      return;
    }

    if (selectionBox) {
      setSelectionBox({ ...selectionBox, width: pos.x - selectionBox.x, height: pos.y - selectionBox.y });
      return;
    }

    if (activeTool === 'door') {
      let closestDistance = Infinity;
      let closestWall: string | null = null;
      let closestPoint: Point | null = null;
      plan.walls.forEach((wall) => {
        const nearest = getNearestPointOnSegment(wall.p1, wall.p2, pos);
        const d = distance(nearest, pos);
        const threshold = 18 / Math.max(scale, .25);
        if (d < threshold && d < closestDistance) {
          closestDistance = d;
          closestWall = wall.id;
          closestPoint = nearest;
        }
      });
      setHoveredWallId(closestWall);
      setDoorPreviewPos(closestPoint);
    }

    if (simulationResult && !isDrawing && activeTool === 'select') {
      const gx = Math.floor(pos.x / simulationResult.resolution);
      const gy = Math.floor(pos.y / simulationResult.resolution);
      if (gx >= 0 && gx < simulationResult.width && gy >= 0 && gy < simulationResult.height) {
        const rssi = simulationResult.data[gy * simulationResult.width + gx];
        setTooltip(rssi > -120 ? { x: pos.x + 12 / scale, y: pos.y + 12 / scale, text: `${rssi.toFixed(0)} dBm` } : null);
      } else setTooltip(null);
    } else setTooltip(null);

    if (!isDrawing) return;
    const snapped = activeTool === 'wall' ? snapToWallEndpoint(pos) : { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
    setCurrentPoint(snapped);
  };

  const handleMouseUp = () => {
    const dragSession = dragSessionRef.current;
    if (dragSession) {
      if (dragSession.moved) {
        const snapped = snapDragDelta(dragSession, dragDelta);
        dispatch({ type: 'TRANSLATE_ENTITIES', payload: { ids: [...dragSession.ids], dx: snapped.x, dy: snapped.y } });
      }
      dragSessionRef.current = null;
      setDragDelta({ x: 0, y: 0 });
      return;
    }

    if (selectionBox) {
      const box = normalizeBox(selectionBox);
      const next = selectionAdditive ? new Set(selectedIds) : new Set<string>();
      if (box.width > 2 || box.height > 2) {
        allEntityIds(plan).forEach((id) => {
          const bounds = entityBounds(id);
          if (bounds && boxesIntersect(box, bounds)) next.add(id);
        });
      }
      setSelectedIds(next);
      setSelectionBox(null);
      return;
    }

    if (!isDrawing || !startPoint || !currentPoint) return;

    if (activeTool === 'wall' && (startPoint.x !== currentPoint.x || startPoint.y !== currentPoint.y)) {
      const id = uuidv4();
      dispatch({ type: 'ADD_WALL', payload: { id, p1: startPoint, p2: currentPoint, thickness: 15, material: WallMaterial.Drywall } });
      setSelectedIds(new Set([id]));
    }

    if (activeTool === 'room') {
      const x1 = Math.min(startPoint.x, currentPoint.x);
      const y1 = Math.min(startPoint.y, currentPoint.y);
      const x2 = Math.max(startPoint.x, currentPoint.x);
      const y2 = Math.max(startPoint.y, currentPoint.y);
      if (x2 - x1 >= gridSize && y2 - y1 >= gridSize) {
        const walls: Wall[] = [
          { id: uuidv4(), p1: { x: x1, y: y1 }, p2: { x: x2, y: y1 }, thickness: 15, material: WallMaterial.Drywall },
          { id: uuidv4(), p1: { x: x2, y: y1 }, p2: { x: x2, y: y2 }, thickness: 15, material: WallMaterial.Drywall },
          { id: uuidv4(), p1: { x: x2, y: y2 }, p2: { x: x1, y: y2 }, thickness: 15, material: WallMaterial.Drywall },
          { id: uuidv4(), p1: { x: x1, y: y2 }, p2: { x: x1, y: y1 }, thickness: 15, material: WallMaterial.Drywall },
        ];
        dispatch({ type: 'ADD_WALLS', payload: walls });
        setSelectedIds(new Set(walls.map((w) => w.id)));
        setActiveTool('select');
      }
    }

    if (activeTool === 'obstacle') {
      let width = currentPoint.x - startPoint.x;
      let height = currentPoint.y - startPoint.y;
      if (Math.abs(width) < 5 && Math.abs(height) < 5) { width = 100; height = 100; }
      if (width && height) {
        const id = uuidv4();
        dispatch({
          type: 'ADD_OBSTACLE',
          payload: {
            id,
            x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
            width: Math.abs(width), height: Math.abs(height), rotation: 0,
            type: ObstacleType.Generic, label: 'Object',
          },
        });
        setSelectedIds(new Set([id]));
        setActiveTool('select');
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const selectedSingleWall = useMemo(() => {
    if (selectedIds.size !== 1 || activeTool !== 'select') return null;
    const id = [...selectedIds][0];
    return plan.walls.find((w) => w.id === id) ?? null;
  }, [activeTool, plan.walls, selectedIds]);

  const handleJointDragMove = (e: Konva.KonvaEventObject<DragEvent>, originalPoint: Point) => {
    const x = snapToGrid(e.target.x());
    const y = snapToGrid(e.target.y());
    const layer = layerRef.current;
    if (!layer) return;
    plan.walls.forEach((w) => {
      let p1 = w.p1;
      let p2 = w.p2;
      let changed = false;
      if (pointKey(w.p1) === pointKey(originalPoint)) { p1 = { x, y }; changed = true; }
      if (pointKey(w.p2) === pointKey(originalPoint)) { p2 = { x, y }; changed = true; }
      if (changed) {
        const line = layer.findOne(`#${w.id}`) as Konva.Line | undefined;
        line?.points([p1.x, p1.y, p2.x, p2.y]);
      }
    });
  };

  const handleJointDragEnd = (e: Konva.KonvaEventObject<DragEvent>, originalPoint: Point) => {
    const x = snapToGrid(e.target.x());
    const y = snapToGrid(e.target.y());
    const updates = plan.walls.flatMap((w) => {
      const p1 = pointKey(w.p1) === pointKey(originalPoint) ? { x, y } : w.p1;
      const p2 = pointKey(w.p2) === pointKey(originalPoint) ? { x, y } : w.p2;
      return p1 !== w.p1 || p2 !== w.p2 ? [{ ...w, p1, p2 }] : [];
    });
    if (updates.length) dispatch({ type: 'UPDATE_WALLS', payload: updates });
  };

  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const lines: React.ReactNode[] = [];
    for (let x = 0; x <= plan.width; x += gridSize) {
      const major = x % (gridSize * 4) === 0;
      lines.push(<Line key={`v${x}`} points={[x, 0, x, plan.height]} stroke={major ? '#d8dee7' : '#e9edf2'} strokeWidth={major ? 1.2 : .7} listening={false} />);
    }
    for (let y = 0; y <= plan.height; y += gridSize) {
      const major = y % (gridSize * 4) === 0;
      lines.push(<Line key={`h${y}`} points={[0, y, plan.width, y]} stroke={major ? '#d8dee7' : '#e9edf2'} strokeWidth={major ? 1.2 : .7} listening={false} />);
    }
    return lines;
  }, [gridSize, plan.height, plan.width, showGrid]);

  return (
    <div className="canvas-container" ref={containerRef}>
      <div className="canvas-help">
        <strong>{activeTool === 'select' ? (selectedIds.size > 1 ? `${selectedIds.size} items selected` : 'Select and edit') : activeTool === 'room' ? 'Drag a room' : activeTool === 'wall' ? 'Drag a wall segment' : activeTool === 'door' ? 'Hover a wall and click' : activeTool === 'router' ? 'Place an access point' : 'Drag an object'}</strong>
        <span>{activeTool === 'select' ? 'Drag selected items together · Shift-click adds/removes · Drag empty space for marquee' : 'Esc returns to Select · Scroll zooms · Hold Space to pan'}</span>
      </div>

      <div className="canvas-zoom-controls" aria-label="Canvas view controls">
        <button type="button" onClick={() => zoomAround(scale / 1.15)} title="Zoom out"><Minus size={15} /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomAround(scale * 1.15)} title="Zoom in"><Plus size={15} /></button>
        <i />
        <button type="button" onClick={fitPlan} title="Fit floor plan"><Maximize2 size={15} /></button>
        <button type="button" onClick={focusSelection} disabled={!selectedIds.size} title="Focus selection"><Crosshair size={15} /></button>
      </div>

      {simulationResult && showHeatmap ? <div className="heatmap-legend"><span>Signal</span><i className="legend-gradient" /><small>Weak</small><small>Strong</small></div> : null}

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={isSpacePressed}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        style={{ cursor: isSpacePressed ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          <Rect name="bg" width={plan.width} height={plan.height} fill="#fff" stroke="#d9dee6" strokeWidth={1} />
          {gridLines}
        </Layer>

        <Layer>
          {simulationResult && showHeatmap ? <Heatmap data={simulationResult} opacity={heatmapOpacity} /> : null}
        </Layer>

        <Layer ref={layerRef}>
          {plan.walls.map((original) => {
            const wall = previewWall(original);
            const selected = selectedIds.has(original.id);
            return <Line
              key={original.id}
              id={original.id}
              points={[wall.p1.x, wall.p1.y, wall.p2.x, wall.p2.y]}
              stroke={selected ? '#2563eb' : '#344054'}
              strokeWidth={original.thickness}
              hitStrokeWidth={Math.max(18, original.thickness + 8)}
              lineCap="square"
              onMouseDown={(e) => beginEntityPointer(original.id, e)}
              onMouseEnter={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = selected ? 'move' : 'pointer'; }}
              onMouseLeave={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = 'default'; }}
            />;
          })}

          {selectedSingleWall ? [selectedSingleWall.p1, selectedSingleWall.p2].map((p, index) => (
            <Circle
              key={`${selectedSingleWall.id}-joint-${index}`}
              x={p.x} y={p.y} radius={7 / Math.max(scale, .55)}
              fill="#fff" stroke="#2563eb" strokeWidth={2 / Math.max(scale, .55)}
              draggable
              onMouseDown={(e) => { e.cancelBubble = true; }}
              onDragMove={(e) => handleJointDragMove(e, p)}
              onDragEnd={(e) => handleJointDragEnd(e, p)}
              onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'move'; }}
              onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
            />
          )) : null}

          {plan.doors.map((door) => {
            const preview = previewDoor(door);
            if (!preview) return null;
            const selected = selectedIds.has(door.id);
            return (
              <Group key={door.id} id={door.id} x={preview.x} y={preview.y} rotation={preview.angle} onMouseDown={(e) => beginEntityPointer(door.id, e)}>
                <Rect
                  x={-door.width / 2} y={-preview.wall.thickness / 2 - 3}
                  width={door.width} height={preview.wall.thickness + 6}
                  fill="#fbbf24" stroke={selected ? '#2563eb' : '#d97706'} strokeWidth={selected ? 2.5 : 1}
                  cornerRadius={2}
                />
                {selectedIds.size === 1 && selected ? <>
                  {[-1, 1].map((side) => <Circle
                    key={side}
                    x={side * door.width / 2} y={0} radius={6 / Math.max(scale, .6)}
                    fill="#fff" stroke="#2563eb" strokeWidth={2 / Math.max(scale, .6)} draggable
                    onMouseDown={(e) => { e.cancelBubble = true; }}
                    onDragMove={(e) => { e.cancelBubble = true; e.target.y(0); }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const oldX = side * door.width / 2;
                      const change = e.target.x() - oldX;
                      const newWidth = Math.max(30, side < 0 ? door.width - change : door.width + change);
                      const centerShift = change / 2;
                      const newDistance = Math.max(newWidth / 2, Math.min(distance(preview.wall.p1, preview.wall.p2) - newWidth / 2, door.distance + centerShift));
                      dispatch({ type: 'UPDATE_DOOR', payload: { ...door, width: newWidth, distance: newDistance } });
                    }}
                  />)}
                </> : null}
              </Group>
            );
          })}

          {plan.obstacles.map((original) => {
            const obs = previewObstacle(original);
            const selected = selectedIds.has(original.id);
            return (
              <Group
                key={original.id} id={original.id} x={obs.x} y={obs.y} width={original.width} height={original.height} rotation={original.rotation}
                onMouseDown={(e) => beginEntityPointer(original.id, e)}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  const sy = node.scaleY();
                  node.scale({ x: 1, y: 1 });
                  dispatch({
                    type: 'UPDATE_OBSTACLE',
                    payload: {
                      ...original,
                      x: snapToGrid(node.x()), y: snapToGrid(node.y()),
                      width: Math.max(25, original.width * Math.abs(sx)),
                      height: Math.max(25, original.height * Math.abs(sy)),
                      rotation: Math.round(node.rotation()),
                    },
                  });
                }}
                onMouseEnter={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = selected ? 'move' : 'pointer'; }}
                onMouseLeave={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = 'default'; }}
              >
                <Rect width={original.width} height={original.height} fill={selected ? '#e8f0ff' : '#eef2f6'} stroke={selected ? '#2563eb' : '#98a2b3'} strokeWidth={selected ? 2 : 1} cornerRadius={5} />
                <Text text={original.label} width={original.width} height={original.height} align="center" verticalAlign="middle" fontSize={12} fill="#475467" listening={false} />
              </Group>
            );
          })}

          {plan.routers.map((original) => {
            const router = previewRouter(original);
            const selected = selectedIds.has(original.id);
            let backhaulColor = '#16a34a';
            const parentOriginal = original.mode === RouterMode.MeshNode && original.meshParentId ? plan.routers.find((r) => r.id === original.meshParentId) : null;
            const parent = parentOriginal ? previewRouter(parentOriginal) : null;
            if (parentOriginal) {
              const rssi = calculateBackhaulRSSI(original.id, plan);
              backhaulColor = original.backhaulType === BackhaulType.Wired ? '#344054' : getSignalQualityColor(rssi);
            }
            return <React.Fragment key={original.id}>
              {parent ? <Line points={[parent.x, parent.y, router.x, router.y]} stroke={backhaulColor} strokeWidth={2} dash={original.backhaulType === BackhaulType.Wired ? [] : [7, 6]} listening={false} /> : null}
              <Group id={original.id} x={router.x} y={router.y} onMouseDown={(e) => beginEntityPointer(original.id, e)}
                onMouseEnter={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = selected ? 'move' : 'pointer'; }}
                onMouseLeave={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = 'default'; }}>
                {selected ? <Circle radius={25} fill="rgba(37,99,235,.08)" stroke="#2563eb" strokeWidth={1.5} dash={[4, 4]} /> : null}
                <Circle radius={16} fill="#fff" stroke={original.mode === RouterMode.MeshRoot ? '#1d4ed8' : '#16a34a'} strokeWidth={3} shadowColor="#0f172a" shadowBlur={selected ? 8 : 3} shadowOpacity={.14} />
                <Circle radius={8} fill={original.mode === RouterMode.MeshNode ? backhaulColor : original.mode === RouterMode.MeshRoot ? '#1d4ed8' : '#16a34a'} />
                <Text text={original.mode === RouterMode.MeshRoot ? 'R' : original.mode === RouterMode.MeshNode ? 'N' : 'S'} x={-4} y={-5} fontSize={10} fill="#fff" listening={false} />
                <Label y={23} listening={false}><Tag fill="rgba(255,255,255,.9)" cornerRadius={4} /><Text text={original.ssid} fontSize={11} fill="#344054" padding={4} offsetX={Math.max(0, original.ssid.length * 2.8)} /></Label>
              </Group>
            </React.Fragment>;
          })}

          <Transformer
            ref={transformerRef}
            rotateEnabled
            borderStroke="#2563eb"
            anchorStroke="#2563eb"
            anchorFill="#fff"
            anchorSize={8}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
            boundBoxFunc={(oldBox, newBox) => newBox.width < 25 || newBox.height < 25 ? oldBox : newBox}
          />

          {selectionBounds ? <>
            <Rect x={selectionBounds.x - 10} y={selectionBounds.y - 10} width={selectionBounds.width + 20} height={selectionBounds.height + 20} stroke="#2563eb" strokeWidth={1.5 / Math.max(scale, .5)} dash={[8 / Math.max(scale, .5), 6 / Math.max(scale, .5)]} listening={false} />
            <Label x={selectionBounds.x - 10} y={selectionBounds.y - 34 / Math.max(scale, .55)} listening={false}><Tag fill="#2563eb" cornerRadius={5} /><Text text={`${selectedIds.size} selected`} fontSize={11 / Math.max(scale, .75)} fill="#fff" padding={5 / Math.max(scale, .75)} /></Label>
          </> : null}

          {selectionBox ? <Rect {...normalizeBox(selectionBox)} fill="rgba(37,99,235,.08)" stroke="#2563eb" strokeWidth={1.4 / Math.max(scale, .5)} dash={[6 / Math.max(scale, .5), 4 / Math.max(scale, .5)]} listening={false} /> : null}

          {isDrawing && startPoint && currentPoint ? <>
            {activeTool === 'wall' ? <Line points={[startPoint.x, startPoint.y, currentPoint.x, currentPoint.y]} stroke="#2563eb" strokeWidth={15} opacity={.55} lineCap="square" dash={[12, 7]} listening={false} /> : null}
            {activeTool === 'room' ? <Rect x={Math.min(startPoint.x, currentPoint.x)} y={Math.min(startPoint.y, currentPoint.y)} width={Math.abs(currentPoint.x - startPoint.x)} height={Math.abs(currentPoint.y - startPoint.y)} stroke="#2563eb" strokeWidth={2} dash={[10, 6]} fill="rgba(37,99,235,.06)" listening={false} /> : null}
            {activeTool === 'obstacle' ? <Rect x={Math.min(startPoint.x, currentPoint.x)} y={Math.min(startPoint.y, currentPoint.y)} width={Math.abs(currentPoint.x - startPoint.x)} height={Math.abs(currentPoint.y - startPoint.y)} stroke="#2563eb" strokeWidth={1.5} dash={[8, 5]} fill="rgba(37,99,235,.06)" listening={false} /> : null}
          </> : null}

          {activeTool === 'door' && hoveredWallId && doorPreviewPos ? <Circle x={doorPreviewPos.x} y={doorPreviewPos.y} radius={8 / Math.max(scale, .6)} fill="#fbbf24" stroke="#fff" strokeWidth={2 / Math.max(scale, .6)} listening={false} /> : null}

          {tooltip ? <Label x={tooltip.x} y={tooltip.y} listening={false}><Tag fill="#111827" opacity={.9} cornerRadius={5} /><Text text={tooltip.text} fontSize={11 / Math.max(scale, .72)} padding={5 / Math.max(scale, .72)} fill="#fff" /></Label> : null}
        </Layer>
      </Stage>
    </div>
  );
};
