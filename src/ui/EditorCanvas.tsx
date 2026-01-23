import React, { useRef, useState, useEffect, useContext, useMemo } from 'react';
import { Stage, Layer, Line, Rect, Group, Text, Transformer, Circle, Label, Tag } from 'react-konva';
import { PlanContext } from '../model/PlanContext';
import { useUI } from './UIContext';
import { v4 as uuidv4 } from 'uuid';
import type { Point } from '../model/types';
import { WallMaterial, ObstacleType, DoorType, RouterMode, BackhaulType } from '../model/types';
import { distance, getNearestPointOnSegment } from '../utils/math';
import Konva from 'konva';
import type { SimulationResponse } from '../sim/worker';
import { Heatmap } from './Heatmap';
import { calculateBackhaulRSSI, getSignalQualityColor } from '../utils/signal';

interface EditorCanvasProps {
    simulationResult?: SimulationResponse | null;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ simulationResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { plan, dispatch } = useContext(PlanContext);
  const { activeTool, gridSize, selectedIds, setSelectedIds, toggleSelection, clearSelection, scale, setScale } = useUI();

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  // Selection Box
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);

  // Door preview state
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [doorPreviewPos, setDoorPreviewPos] = useState<Point | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{x: number, y: number, text: string} | null>(null);

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Key press for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        selectedIds.forEach(id => {
            if (plan.walls.some(w => w.id === id)) {
                dispatch({ type: 'DELETE_WALL', payload: id });
            } else if (plan.obstacles.some(o => o.id === id)) {
                 dispatch({ type: 'DELETE_OBSTACLE', payload: id });
            } else if (plan.doors.some(d => d.id === id)) {
                 dispatch({ type: 'DELETE_DOOR', payload: id });
            } else if (plan.routers.some(r => r.id === id)) {
                dispatch({ type: 'DELETE_ROUTER', payload: id });
            }
        });
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, plan, dispatch, clearSelection]);

  // Update Transformer selection
  useEffect(() => {
    if (selectedIds.size > 0 && transformerRef.current) {
        const stage = transformerRef.current.getStage();
        if (stage) {
             const nodes: Konva.Node[] = [];
             selectedIds.forEach(id => {
                 const node = stage.findOne('#' + id);
                 if (node && (node instanceof Konva.Group || node instanceof Konva.Circle)) {
                     nodes.push(node);
                 }
             });

             transformerRef.current.nodes(nodes);
             transformerRef.current.getLayer()?.batchDraw();
        }
    } else if (transformerRef.current) {
        transformerRef.current.nodes([]);
    }
  }, [selectedIds, plan]);


  const snapToGrid = (val: number) => {
    return Math.round(val / gridSize) * gridSize;
  };

  const snapToWallEndpoint = (pos: Point) => {
      // Check existing wall endpoints
      const threshold = 20; // px
      let closest: Point | null = null;
      let minDst = Infinity;

      for (const wall of plan.walls) {
          const d1 = distance(wall.p1, pos);
          if (d1 < threshold && d1 < minDst) {
              minDst = d1;
              closest = wall.p1;
          }
           const d2 = distance(wall.p2, pos);
          if (d2 < threshold && d2 < minDst) {
              minDst = d2;
              closest = wall.p2;
          }
      }

      if (closest) return closest;
      return { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
  };

  const getStagePointerPosition = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const stageScale = stage.scaleX();
    const position = stage.position();
    return {
      x: (pointer.x - position.x) / stageScale,
      y: (pointer.y - position.y) / stageScale,
    };
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    if (newScale < 0.1 || newScale > 10) return;

    setScale(newScale);

    const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    // If clicking on empty stage, deselect (unless holding shift for multiselect, to be added)
    const clickedOnEmpty = e.target === stage || e.target.hasName('bg');

    const pos = getStagePointerPosition(stage);
    if (!pos) return;

    if (activeTool === 'select' && clickedOnEmpty) {
        // Start selection box
        if (!e.evt.shiftKey) {
            clearSelection();
        }
        setSelectionBox({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0
        });
        return; // Don't process other tools
    }

    if (clickedOnEmpty && activeTool !== 'select') {
        clearSelection();
    }

    if (activeTool === 'router') {
        const snapedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
        dispatch({
            type: 'ADD_ROUTER',
            payload: {
                id: uuidv4(),
                x: snapedPos.x,
                y: snapedPos.y,
                txPower: 20,
                band: 5,
                gain: 2,
                ssid: `AP-${plan.routers.length + 1}`,
                mode: RouterMode.Solo,
                meshParentId: null,
                backhaulType: BackhaulType.Wireless,
                backhaulBand: 5
            }
        });
        return;
    }

    if (activeTool === 'door') {
        if (hoveredWallId && doorPreviewPos) {
            const wall = plan.walls.find(w => w.id === hoveredWallId);
            if (wall) {
                const dist = distance(wall.p1, doorPreviewPos);
                dispatch({
                    type: 'ADD_DOOR',
                    payload: {
                        id: uuidv4(),
                        wallId: hoveredWallId,
                        distance: dist,
                        width: 80,
                        type: DoorType.Wood
                    }
                });
            }
        }
        return;
    }

    if (activeTool !== 'wall' && activeTool !== 'obstacle') return;

    const snapedPos = activeTool === 'wall' ? snapToWallEndpoint(pos) : { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };

    setIsDrawing(true);
    setStartPoint(snapedPos);
    setCurrentPoint(snapedPos);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getStagePointerPosition(stage);
    if (!pos) return;

    // Selection Box Logic
    if (selectionBox) {
        setSelectionBox({
            ...selectionBox,
            width: pos.x - selectionBox.x,
            height: pos.y - selectionBox.y
        });
        return;
    }

    // Tooltip logic
    if (simulationResult && !isDrawing) {
        const gx = Math.floor(pos.x / simulationResult.resolution);
        const gy = Math.floor(pos.y / simulationResult.resolution);
        if (gx >= 0 && gx < simulationResult.width && gy >= 0 && gy < simulationResult.height) {
            const index = gy * simulationResult.width + gx;
            const rssi = simulationResult.data[index];
            if (rssi > -120) {
                 setTooltip({
                     x: pos.x + 10,
                     y: pos.y + 10,
                     text: `${rssi.toFixed(1)} dBm`
                 });
            } else {
                setTooltip(null);
            }
        } else {
             setTooltip(null);
        }
    } else {
        setTooltip(null);
    }


    if (activeTool === 'door') {
        let closestDist = Infinity;
        let closestWallId = null;
        let closestPoint = null;

        plan.walls.forEach(wall => {
            const nearest = getNearestPointOnSegment(wall.p1, wall.p2, pos);
            const dist = distance(nearest, pos);
            if (dist < 20) {
                if (dist < closestDist) {
                    closestDist = dist;
                    closestWallId = wall.id;
                    closestPoint = nearest;
                }
            }
        });

        if (closestWallId && closestPoint) {
            setHoveredWallId(closestWallId);
            setDoorPreviewPos(closestPoint);
        } else {
            setHoveredWallId(null);
            setDoorPreviewPos(null);
        }
    }

    if (!isDrawing) return;

    const snapedPos = activeTool === 'wall' ? snapToWallEndpoint(pos) : { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
    setCurrentPoint(snapedPos);
  };

  const handleMouseUp = () => {
    // Selection Box End
    if (selectionBox) {
        // Calculate bounding box normalized
        const x1 = Math.min(selectionBox.x, selectionBox.x + selectionBox.width);
        const x2 = Math.max(selectionBox.x, selectionBox.x + selectionBox.width);
        const y1 = Math.min(selectionBox.y, selectionBox.y + selectionBox.height);
        const y2 = Math.max(selectionBox.y, selectionBox.y + selectionBox.height);

        const newSelected = new Set(selectedIds);

        // Find intersecting objects
        // Walls
        plan.walls.forEach(w => {
            // Simple AABB check for segments is tricky, check if endpoints inside
            if ((w.p1.x >= x1 && w.p1.x <= x2 && w.p1.y >= y1 && w.p1.y <= y2) ||
                (w.p2.x >= x1 && w.p2.x <= x2 && w.p2.y >= y1 && w.p2.y <= y2)) {
                newSelected.add(w.id);
            }
        });
        // Obstacles
        plan.obstacles.forEach(o => {
            if (o.x >= x1 && o.x <= x2 && o.y >= y1 && o.y <= y2) { // Center point check, or corner check? AABB check better.
                // Assuming o.x, o.y is top-left
                if (o.x + o.width >= x1 && o.x <= x2 && o.y + o.height >= y1 && o.y <= y2) {
                    newSelected.add(o.id);
                }
            }
        });
        // Routers
        plan.routers.forEach(r => {
            if (r.x >= x1 && r.x <= x2 && r.y >= y1 && r.y <= y2) {
                newSelected.add(r.id);
            }
        });

        setSelectedIds(newSelected);
        setSelectionBox(null);
        return;
    }

    if (!isDrawing || !startPoint || !currentPoint) return;

    if (activeTool === 'wall') {
        if (startPoint.x !== currentPoint.x || startPoint.y !== currentPoint.y) {
          dispatch({
            type: 'ADD_WALL',
            payload: {
              id: uuidv4(),
              p1: startPoint,
              p2: currentPoint,
              thickness: 15,
              material: WallMaterial.Drywall,
            },
          });
        }
    } else if (activeTool === 'obstacle') {
        let width = currentPoint.x - startPoint.x;
        let height = currentPoint.y - startPoint.y;

        // Default size if simple click
        if (Math.abs(width) < 5 && Math.abs(height) < 5) {
            width = 100;
            height = 100;
        }

        if (width !== 0 && height !== 0) {
            dispatch({
                type: 'ADD_OBSTACLE',
                payload: {
                    id: uuidv4(),
                    x: Math.min(startPoint.x, currentPoint.x),
                    y: Math.min(startPoint.y, currentPoint.y),
                    width: Math.abs(width),
                    height: Math.abs(height),
                    rotation: 0,
                    type: ObstacleType.Generic,
                    label: 'Obstacle'
                }
            })
        }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  // Identify unique endpoints for Wall Joints
  const uniqueEndpoints = useMemo(() => {
      const points: Point[] = [];
      const keys = new Set<string>();

      plan.walls.forEach(w => {
          [w.p1, w.p2].forEach(p => {
              const key = `${p.x},${p.y}`;
              if (!keys.has(key)) {
                  keys.add(key);
                  points.push(p);
              }
          });
      });
      return points;
  }, [plan.walls]);

  const handleJointDragMove = (e: Konva.KonvaEventObject<DragEvent>, originalPoint: Point) => {
      // In Konva, dragging updates the x/y properties to the absolute position relative to parent.
      // Since the Circle is a direct child of Layer, x() and y() are the world coordinates.
      // We don't add originalPoint because the node has already moved there.

      const newX = snapToGrid(e.target.x());
      const newY = snapToGrid(e.target.y());

      // Update visual lines directly
      const layer = layerRef.current;
      if (layer) {
          plan.walls.forEach(w => {
              let p1 = w.p1;
              let p2 = w.p2;
              let update = false;

              if (w.p1.x === originalPoint.x && w.p1.y === originalPoint.y) {
                  p1 = { x: newX, y: newY };
                  update = true;
              }
              if (w.p2.x === originalPoint.x && w.p2.y === originalPoint.y) {
                  p2 = { x: newX, y: newY };
                  update = true;
              }

              if (update) {
                  const line = layer.findOne('#' + w.id) as Konva.Line;
                  if (line) {
                      line.points([p1.x, p1.y, p2.x, p2.y]);
                  }
              }
          });
      }
  };

  const handleJointDragEnd = (e: Konva.KonvaEventObject<DragEvent>, originalPoint: Point) => {
      // Get final position
      const newX = snapToGrid(e.target.x());
      const newY = snapToGrid(e.target.y());

      // We don't manually reset x/y to 0 here.
      // When we dispatch the update, React will re-render the Circle with new x={newX} y={newY}.
      // React-Konva will update the node's position to match the prop.
      // Since e.target.x() is already newX (approx), it stays put.

      // Find all walls connected to originalPoint and update them
      plan.walls.forEach(w => {
          let updated = false;
          let newP1 = w.p1;
          let newP2 = w.p2;

          if (w.p1.x === originalPoint.x && w.p1.y === originalPoint.y) {
              newP1 = { x: newX, y: newY };
              updated = true;
          }
          if (w.p2.x === originalPoint.x && w.p2.y === originalPoint.y) {
              newP2 = { x: newX, y: newY };
              updated = true;
          }

          if (updated) {
              dispatch({
                  type: 'UPDATE_WALL',
                  payload: { ...w, p1: newP1, p2: newP2 }
              });
          }
      });
  };

  // Generate grid lines
  const gridLines = [];
  const width = Math.max(size.width, plan.width);
  const height = Math.max(size.height, plan.height);

  for (let i = 0; i <= width; i += gridSize) {
    gridLines.push(
        <Line
          key={`v${i}`}
          points={[i, 0, i, height]}
          stroke="#ddd"
          strokeWidth={1}
          listening={false}
        />
    );
  }
  for (let j = 0; j <= height; j += gridSize) {
    gridLines.push(
        <Line
          key={`h${j}`}
          points={[0, j, width, j]}
          stroke="#ddd"
          strokeWidth={1}
          listening={false}
        />
    );
  }

  return (
    <div className="canvas-container" ref={containerRef}>
      <Stage
        width={size.width}
        height={size.height}
        draggable={activeTool === 'select' || activeTool === 'obstacle' || activeTool === 'router'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        style={{ cursor: activeTool === 'select' ? 'grab' : 'crosshair' }}
      >
        <Layer>
            <Rect
                name="bg"
                width={plan.width}
                height={plan.height}
                fill="#fff"
                onClick={() => setSelectedIds(new Set())}
            />
            {gridLines}
        </Layer>

        <Layer>
            {simulationResult && (
                <Heatmap data={simulationResult} />
            )}
        </Layer>

        <Layer ref={layerRef}>
          {plan.walls.map((wall) => (
            <React.Fragment key={wall.id}>
                 <Line
                    id={wall.id}
                    points={[wall.p1.x, wall.p1.y, wall.p2.x, wall.p2.y]}
                    stroke={selectedIds.has(wall.id) ? '#00f' : '#333'}
                    strokeWidth={wall.thickness}
                    lineCap="square"
                    onClick={(e) => {
                        if (activeTool === 'select') {
                            e.cancelBubble = true;
                            if (e.evt.shiftKey) {
                                toggleSelection(wall.id);
                            } else {
                                setSelectedIds(new Set([wall.id]));
                            }
                        }
                    }}
                    draggable={activeTool === 'select'}
                    onDragMove={(e) => {
                        // Edge dragging logic - move connected endpoints visually
                        const dx = e.target.x();
                        const dy = e.target.y();
                        const p1 = { x: wall.p1.x + dx, y: wall.p1.y + dy };
                        const p2 = { x: wall.p2.x + dx, y: wall.p2.y + dy };

                        // We need to move visuals of OTHER lines connected to p1 or p2
                        // This is tricky because we don't have easy access to them without iterating
                        // For smooth rubber banding of edges, we need to find neighbors.

                        const layer = layerRef.current;
                        if (layer) {
                            plan.walls.forEach(other => {
                                if (other.id === wall.id) return;
                                let op1 = other.p1;
                                let op2 = other.p2;
                                let update = false;

                                if (other.p1.x === wall.p1.x && other.p1.y === wall.p1.y) {
                                    op1 = p1; update = true;
                                } else if (other.p1.x === wall.p2.x && other.p1.y === wall.p2.y) {
                                    op1 = p2; update = true;
                                }

                                if (other.p2.x === wall.p1.x && other.p2.y === wall.p1.y) {
                                    op2 = p1; update = true;
                                } else if (other.p2.x === wall.p2.x && other.p2.y === wall.p2.y) {
                                    op2 = p2; update = true;
                                }

                                if (update) {
                                    const line = layer.findOne('#' + other.id) as Konva.Line;
                                    if (line) {
                                        line.points([op1.x, op1.y, op2.x, op2.y]);
                                    }
                                }
                            });

                            // Also update Joints (Circles) visually
                            const joints = layer.find('Circle');
                            joints.forEach(shape => {
                                if (shape.name() === 'joint') {
                                    // joints are not identified by ID, but by position.
                                    // This part is hard because joints are rendered based on state.
                                    // If we move the line, the state hasn't changed, so joints stay put.
                                    // We need to move the joints that match wall.p1 and wall.p2
                                    const jx = shape.attrs.x;
                                    const jy = shape.attrs.y;

                                    if (jx === wall.p1.x && jy === wall.p1.y) {
                                        shape.position({x: p1.x, y: p1.y});
                                    } else if (jx === wall.p2.x && jy === wall.p2.y) {
                                        shape.position({x: p2.x, y: p2.y});
                                    }
                                }
                            });
                        }
                    }}
                    onDragEnd={(e) => {
                         const dx = e.target.x();
                         const dy = e.target.y();
                         e.target.x(0);
                         e.target.y(0);

                         const newP1 = { x: snapToGrid(wall.p1.x + dx), y: snapToGrid(wall.p1.y + dy) };
                         const newP2 = { x: snapToGrid(wall.p2.x + dx), y: snapToGrid(wall.p2.y + dy) };

                         // We need to update this wall AND connected walls
                         // Dispatching multiple actions? Or a batch update?
                         // Current reducer handles one action.
                         // But we can dispatch individually.

                         // Better: Find all affected walls and update them.

                         // List of actions to dispatch
                         const updates = [];

                         // Update dragged wall
                         updates.push({
                             type: 'UPDATE_WALL',
                             payload: { ...wall, p1: newP1, p2: newP2 }
                         });

                         // Update neighbors
                         plan.walls.forEach(other => {
                             if (other.id === wall.id) return;
                             let op1 = other.p1;
                             let op2 = other.p2;
                             let update = false;

                             if (other.p1.x === wall.p1.x && other.p1.y === wall.p1.y) {
                                 op1 = newP1; update = true;
                             } else if (other.p1.x === wall.p2.x && other.p1.y === wall.p2.y) {
                                 op1 = newP2; update = true;
                             }

                             if (other.p2.x === wall.p1.x && other.p2.y === wall.p1.y) {
                                 op2 = newP1; update = true;
                             } else if (other.p2.x === wall.p2.x && other.p2.y === wall.p2.y) {
                                 op2 = newP2; update = true;
                             }

                             if (update) {
                                 updates.push({
                                     type: 'UPDATE_WALL',
                                     payload: { ...other, p1: op1, p2: op2 }
                                 });
                             }
                         });

                         // Dispatch all
                         // Ideally we should have a BATCH_ACTION or handle it in reducer
                         // For now, looping dispatch is fine, but history will have multiple entries?
                         // History reducer wraps the dispatch.
                         // If we call dispatch multiple times, we get multiple history steps.
                         // We need a transaction or batch.
                         // Let's rely on individual dispatches for now or add a BATCH_UPDATE_WALLS action.
                         // Adding BATCH_UPDATE_WALLS is cleaner.

                         // But I can't easily change reducer signature without breaking things.
                         // Let's execute them.
                         updates.forEach(u => dispatch(u));
                    }}
                  />
            </React.Fragment>
          ))}

          {/* Wall Joints (Handles) */}
          {activeTool === 'select' && uniqueEndpoints.map((p) => (
              <Circle
                key={`joint-${p.x}-${p.y}`}
                name="joint"
                x={p.x}
                y={p.y}
                radius={6}
                fill="#fff"
                stroke="#00f"
                strokeWidth={2}
                draggable
                onDragMove={(e) => handleJointDragMove(e, p)}
                onDragEnd={(e) => handleJointDragEnd(e, p)}
                onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'move';
                }}
                onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'default';
                }}
              />
          ))}

          {plan.doors.map((door) => {
              const wall = plan.walls.find(w => w.id === door.wallId);
              if (!wall) return null;

              const len = distance(wall.p1, wall.p2);
              if (len === 0) return null;

              const dx = (wall.p2.x - wall.p1.x) / len;
              const dy = (wall.p2.y - wall.p1.y) / len;

              const x = wall.p1.x + dx * door.distance;
              const y = wall.p1.y + dy * door.distance;

              const angle = Math.atan2(dy, dx) * 180 / Math.PI;

              return (
                  <Group
                    key={door.id}
                    x={x}
                    y={y}
                    rotation={angle}
                    draggable={activeTool === 'select'}
                    onClick={(e) => {
                         if (activeTool === 'select') {
                            e.cancelBubble = true;
                            if (e.evt.shiftKey) {
                                toggleSelection(door.id);
                            } else {
                                setSelectedIds(new Set([door.id]));
                            }
                        }
                    }}
                    onDragEnd={(e) => {
                        const node = e.target;
                        const newX = node.x();
                        const newY = node.y();
                        const p = { x: newX, y: newY };
                        const nearest = getNearestPointOnSegment(wall.p1, wall.p2, p);
                        const newDist = distance(wall.p1, nearest);

                        dispatch({
                            type: 'UPDATE_DOOR',
                            payload: {
                                ...door,
                                distance: newDist
                            }
                        });
                    }}
                  >
                     <Rect
                        x={-door.width/2}
                        y={-wall.thickness/2 - 2}
                        width={door.width}
                        height={wall.thickness + 4}
                        fill="#D2691E"
                        stroke={selectedIds.has(door.id) ? '#00f' : 'transparent'}
                        strokeWidth={2}
                     />
                     {/* Door Handles for Resizing */}
                     {selectedIds.has(door.id) && (
                         <>
                             {/* Left Handle */}
                             <Circle
                                x={-door.width/2}
                                y={0}
                                radius={5}
                                fill="#00f"
                                draggable
                                onDragMove={(e) => {
                                    // Constrain to wall line?
                                    // Since parent Group is rotated, dragging along X axis is dragging along wall.
                                    e.target.y(0); // Constrain to local Y=0
                                }}
                                onDragEnd={(e) => {
                                    e.target.y(0);
                                    // dx is change in local X relative to 0 (which was -width/2)
                                    // new x is e.target.x()
                                    // delta width = (-width/2) - newX
                                    // new width = width + delta?
                                    // Let's think: center of door shifts if we only move one side.
                                    // But door model is center-based (implied by rendering)?
                                    // Actually door model is: distance (center or start?), width.
                                    // Render: x = wall.p1 + dx * distance.
                                    // Render: Rect x = -door.width/2. So 'distance' is the CENTER of the door.

                                    const newLocalX = e.target.x();
                                    const oldLocalX = -door.width/2;
                                    const change = newLocalX - oldLocalX;

                                    // If we move left handle to right (positive change), width decreases, center moves right.
                                    // If we move left handle to left (negative change), width increases, center moves left.
                                    // Change in width = -change (if right edge fixed)
                                    // Change in center = change / 2

                                    const newWidth = door.width - change;
                                    const newDist = door.distance + change / 2; // In px? Yes distance is px.

                                    if (newWidth > 10) {
                                        dispatch({
                                            type: 'UPDATE_DOOR',
                                            payload: {
                                                ...door,
                                                distance: newDist,
                                                width: newWidth
                                            }
                                        });
                                    } else {
                                        // Revert visual
                                        e.target.x(-door.width/2);
                                    }
                                }}
                             />
                             {/* Right Handle */}
                             <Circle
                                x={door.width/2}
                                y={0}
                                radius={5}
                                fill="#00f"
                                draggable
                                onDragMove={(e) => {
                                    e.target.y(0);
                                }}
                                onDragEnd={(e) => {
                                    e.target.y(0);
                                    const newLocalX = e.target.x();
                                    const oldLocalX = door.width/2;
                                    const change = newLocalX - oldLocalX;

                                    // Right handle moves right: width increases, center moves right.
                                    const newWidth = door.width + change;
                                    const newDist = door.distance + change / 2;

                                    if (newWidth > 10) {
                                        dispatch({
                                            type: 'UPDATE_DOOR',
                                            payload: {
                                                ...door,
                                                distance: newDist,
                                                width: newWidth
                                            }
                                        });
                                    } else {
                                        e.target.x(door.width/2);
                                    }
                                }}
                             />
                         </>
                     )}
                  </Group>
              );
          })}


           {plan.obstacles.map((obs) => (
             <Group
                key={obs.id}
                id={obs.id}
                x={obs.x}
                y={obs.y}
                rotation={obs.rotation}
                draggable={activeTool === 'select'}
                onClick={(e) => {
                    if (activeTool === 'select') {
                        e.cancelBubble = true;
                        if (e.evt.shiftKey) {
                            toggleSelection(obs.id);
                        } else {
                            setSelectedIds(new Set([obs.id]));
                        }
                    }
                }}
                onDragEnd={(e) => {
                    dispatch({
                        type: 'UPDATE_OBSTACLE',
                        payload: {
                            ...obs,
                            x: snapToGrid(e.target.x()),
                            y: snapToGrid(e.target.y()),
                        }
                    })
                }}
                onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    dispatch({
                        type: 'UPDATE_OBSTACLE',
                        payload: {
                            ...obs,
                            x: node.x(),
                            y: node.y(),
                            width: Math.max(5, node.width() * scaleX),
                            height: Math.max(5, node.height() * scaleY),
                            rotation: node.rotation(),
                        },
                    });
                }}
            >
                <Rect
                    width={obs.width}
                    height={obs.height}
                    fill={selectedIds.has(obs.id) ? '#aaccff' : '#cccccc'}
                    stroke={selectedIds.has(obs.id) ? '#0055aa' : '#999999'}
                    strokeWidth={1}
                />
                <Text
                    text={obs.label}
                    width={obs.width}
                    height={obs.height}
                    align="center"
                    verticalAlign="middle"
                    fontSize={12}
                    fill="#000"
                    listening={false}
                />
             </Group>
          ))}

          {plan.routers.map((router) => {
              let backhaulColor = '#00aa00';
              let parentNode = null;

              if (router.mode === RouterMode.MeshNode && router.meshParentId) {
                  parentNode = plan.routers.find(r => r.id === router.meshParentId);
                  const rssi = calculateBackhaulRSSI(router.id, plan);
                  backhaulColor = router.backhaulType === BackhaulType.Wired ? '#000000' : getSignalQualityColor(rssi);
              }

              return (
              <React.Fragment key={router.id}>
                  {parentNode && (
                      <Line
                        points={[parentNode.x, parentNode.y, router.x, router.y]}
                        stroke={backhaulColor}
                        strokeWidth={2}
                        dash={router.backhaulType === BackhaulType.Wired ? [] : [5, 5]}
                        listening={false}
                      />
                  )}

                  <Group
                    id={router.id}
                    name="router"
                    x={router.x}
                    y={router.y}
                    draggable={activeTool === 'select'}
                    onClick={(e) => {
                        if (activeTool === 'select') {
                            e.cancelBubble = true;
                            if (e.evt.shiftKey) {
                                toggleSelection(router.id);
                            } else {
                                setSelectedIds(new Set([router.id]));
                            }
                        }
                    }}
                    onDragEnd={(e) => {
                        dispatch({
                            type: 'UPDATE_ROUTER',
                            payload: {
                                ...router,
                                x: snapToGrid(e.target.x()),
                                y: snapToGrid(e.target.y()),
                            }
                        })
                    }}
                  >
                    <Circle
                        radius={15}
                        fill={selectedIds.has(router.id) ? '#ccffcc' : '#ffffff'}
                        stroke={router.mode === RouterMode.MeshRoot ? '#0000aa' : '#00aa00'}
                        strokeWidth={router.mode === RouterMode.MeshRoot ? 3 : 2}
                    />

                    <Circle
                        radius={8}
                        fill={router.mode === RouterMode.MeshNode ? backhaulColor : (router.mode === RouterMode.MeshRoot ? '#0000aa' : '#00aa00')}
                    />

                    <Text
                        text={router.ssid}
                        y={20}
                        align="center"
                        fontSize={12}
                        fill="#000"
                        offsetX={router.ssid.length * 3}
                    />
                    <Text
                        text={router.mode === RouterMode.MeshRoot ? 'R' : router.mode === RouterMode.MeshNode ? 'N' : 'S'}
                        align="center"
                        verticalAlign="middle"
                        fontSize={10}
                        fill="#fff"
                        x={-3}
                        y={-4}
                        listening={false}
                    />
                  </Group>
              </React.Fragment>
              );
          })}

           {/* Transformer for selected objects */}
            <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 5 || newBox.height < 5) {
                        return oldBox;
                    }
                    return newBox;
                }}
            />

            {/* Selection Box */}
            {selectionBox && (
                <Rect
                    x={selectionBox.x}
                    y={selectionBox.y}
                    width={selectionBox.width}
                    height={selectionBox.height}
                    fill="rgba(0, 161, 255, 0.3)"
                    stroke="rgba(0, 161, 255, 0.8)"
                    strokeWidth={1}
                />
            )}

          {/* Drawing Preview */}
          {isDrawing && startPoint && currentPoint && (
              <>
             {activeTool === 'wall' && (
                <Line
                    points={[startPoint.x, startPoint.y, currentPoint.x, currentPoint.y]}
                    stroke="#999"
                    strokeWidth={15}
                    lineCap="square"
                    dash={[10, 5]}
                />
             )}
             {activeTool === 'obstacle' && (
                 <Rect
                    x={Math.min(startPoint.x, currentPoint.x)}
                    y={Math.min(startPoint.y, currentPoint.y)}
                    width={Math.abs(currentPoint.x - startPoint.x)}
                    height={Math.abs(currentPoint.y - startPoint.y)}
                    stroke="#999"
                    strokeWidth={1}
                    dash={[10, 5]}
                 />
             )}
             </>
          )}

          {/* Door Preview */}
          {activeTool === 'door' && hoveredWallId && doorPreviewPos && (
             <Circle
                x={doorPreviewPos.x}
                y={doorPreviewPos.y}
                radius={5}
                fill="green"
             />
          )}

          {/* Tooltip */}
          {tooltip && (
              <Label x={tooltip.x} y={tooltip.y} listening={false}>
                  <Tag fill="black" opacity={0.75} pointerDirection="down" pointerWidth={10} pointerHeight={10} lineJoin="round" shadowColor="black" shadowBlur={10} shadowOffset={{x:10,y:10}} shadowOpacity={0.2}/>
                  <Text text={tooltip.text} fontFamily="Calibri" fontSize={14} padding={5} fill="white" />
              </Label>
          )}
        </Layer>
      </Stage>
    </div>
  );
};
