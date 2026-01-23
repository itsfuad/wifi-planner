import React, { useRef, useState, useEffect, useContext } from 'react';
import { Stage, Layer, Line, Rect, Group, Text, Transformer, Circle, Label, Tag } from 'react-konva';
import { PlanContext } from '../model/PlanContext';
import { useUI } from './UIContext';
import { v4 as uuidv4 } from 'uuid';
import type { Point } from '../model/types';
import { WallMaterial, ObstacleType, DoorType } from '../model/types';
import { distance, getNearestPointOnSegment } from '../utils/math';
import Konva from 'konva';
import type { SimulationResponse } from '../sim/worker';
import { Heatmap } from './Heatmap';

interface EditorCanvasProps {
    simulationResult?: SimulationResponse | null;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ simulationResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { plan, dispatch } = useContext(PlanContext);
  const { activeTool, gridSize, selectedId, setSelectedId, scale, setScale } = useUI();

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  // Door preview state
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [doorPreviewPos, setDoorPreviewPos] = useState<Point | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        if (plan.walls.some(w => w.id === selectedId)) {
            dispatch({ type: 'DELETE_WALL', payload: selectedId });
        } else if (plan.obstacles.some(o => o.id === selectedId)) {
             dispatch({ type: 'DELETE_OBSTACLE', payload: selectedId });
        } else if (plan.doors.some(d => d.id === selectedId)) {
             dispatch({ type: 'DELETE_DOOR', payload: selectedId });
        } else if (plan.routers.some(r => r.id === selectedId)) {
            dispatch({ type: 'DELETE_ROUTER', payload: selectedId });
        }
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, plan, dispatch, setSelectedId]);

  // Update Transformer selection
  useEffect(() => {
    if (selectedId && transformerRef.current) {
        const stage = transformerRef.current.getStage();
        if (stage) {
             const selectedNode = stage.findOne('#' + selectedId);
             if (selectedNode && (selectedNode instanceof Konva.Group || selectedNode instanceof Konva.Circle)) {
                 if (selectedNode.name() === 'router') {
                     transformerRef.current.nodes([selectedNode]);
                     transformerRef.current.resizeEnabled(false);
                     transformerRef.current.rotateEnabled(false);
                 } else {
                     transformerRef.current.nodes([selectedNode]);
                     transformerRef.current.resizeEnabled(true);
                     transformerRef.current.rotateEnabled(true);
                 }
                 transformerRef.current.getLayer()?.batchDraw();
             } else {
                 transformerRef.current.nodes([]);
             }
        }
    } else if (transformerRef.current) {
        transformerRef.current.nodes([]);
    }
  }, [selectedId, plan]);


  const snapToGrid = (val: number) => {
    return Math.round(val / gridSize) * gridSize;
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

    // Limit scale
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

    // If clicking on empty stage, deselect
    const clickedOnEmpty = e.target === stage || e.target.hasName('bg');
    if (clickedOnEmpty) {
        setSelectedId(null);
    }

    const pos = getStagePointerPosition(stage);
    if (!pos) return;

    if (activeTool === 'router') {
        const snapedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
        dispatch({
            type: 'ADD_ROUTER',
            payload: {
                id: uuidv4(),
                x: snapedPos.x,
                y: snapedPos.y,
                txPower: 20, // 20 dBm default
                band: 5, // 5 GHz default
                gain: 2, // 2 dBi default
                ssid: `AP-${plan.routers.length + 1}`,
                isMesh: false,
                meshParentId: null
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
                        width: 80, // Default 80cm
                        type: DoorType.Wood
                    }
                });
            }
        }
        return;
    }

    if (activeTool !== 'wall' && activeTool !== 'obstacle') return;

    const snapedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };

    setIsDrawing(true);
    setStartPoint(snapedPos);
    setCurrentPoint(snapedPos);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getStagePointerPosition(stage);
    if (!pos) return;

    // Tooltip logic
    if (simulationResult && !isDrawing) {
        // Map pos to grid index
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
        // Find nearest wall
        let closestDist = Infinity;
        let closestWallId = null;
        let closestPoint = null;

        plan.walls.forEach(wall => {
            const nearest = getNearestPointOnSegment(wall.p1, wall.p2, pos);
            const dist = distance(nearest, pos);
            if (dist < 20) { // Threshold 20px
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

    const snapedPos = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
    setCurrentPoint(snapedPos);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !currentPoint) return;

    if (activeTool === 'wall') {
        if (startPoint.x !== currentPoint.x || startPoint.y !== currentPoint.y) {
          dispatch({
            type: 'ADD_WALL',
            payload: {
              id: uuidv4(),
              p1: startPoint,
              p2: currentPoint,
              thickness: 15, // Default
              material: WallMaterial.Drywall,
            },
          });
        }
    } else if (activeTool === 'obstacle') {
        const width = currentPoint.x - startPoint.x;
        const height = currentPoint.y - startPoint.y;

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
        draggable={activeTool === 'select' || activeTool === 'obstacle' || activeTool === 'router'} // Allow panning if holding middle mouse or similar (Konva handles drag on stage) - stick to select for now or allow spacebar (not implemented)
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        style={{ cursor: activeTool === 'select' ? 'grab' : 'crosshair' }}
      >
        <Layer>
            {/* Background */}
            <Rect
                name="bg"
                width={plan.width}
                height={plan.height}
                fill="#fff"
                onClick={() => setSelectedId(null)}
            />
            {gridLines}
        </Layer>

        <Layer>
            {/* Heatmap Layer - should be below objects but above grid/bg? */}
            {simulationResult && (
                <Heatmap data={simulationResult} />
            )}
        </Layer>

        <Layer>
          {plan.walls.map((wall) => (
            <React.Fragment key={wall.id}>
                 <Line
                    points={[wall.p1.x, wall.p1.y, wall.p2.x, wall.p2.y]}
                    stroke={selectedId === wall.id ? '#00f' : '#333'}
                    strokeWidth={wall.thickness}
                    lineCap="square"
                    onClick={(e) => {
                        if (activeTool === 'select') {
                            e.cancelBubble = true;
                            setSelectedId(wall.id);
                        }
                    }}
                  />
            </React.Fragment>
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
                    onClick={(e) => {
                         if (activeTool === 'select') {
                            e.cancelBubble = true;
                            setSelectedId(door.id);
                        }
                    }}
                  >
                     <Rect
                        x={-door.width/2}
                        y={-wall.thickness/2 - 2}
                        width={door.width}
                        height={wall.thickness + 4}
                        fill="#D2691E"
                        stroke={selectedId === door.id ? '#00f' : 'transparent'}
                        strokeWidth={2}
                     />
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
                        setSelectedId(obs.id);
                    }
                }}
                onDragEnd={(e) => {
                    dispatch({
                        type: 'UPDATE_OBSTACLE',
                        payload: {
                            ...obs,
                            x: e.target.x(),
                            y: e.target.y(),
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
                    fill={selectedId === obs.id ? '#aaccff' : '#cccccc'}
                    stroke={selectedId === obs.id ? '#0055aa' : '#999999'}
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

          {plan.routers.map((router) => (
              <Group
                key={router.id}
                id={router.id}
                name="router"
                x={router.x}
                y={router.y}
                draggable={activeTool === 'select'}
                onClick={(e) => {
                    if (activeTool === 'select') {
                        e.cancelBubble = true;
                        setSelectedId(router.id);
                    }
                }}
                onDragEnd={(e) => {
                     dispatch({
                        type: 'UPDATE_ROUTER',
                        payload: {
                            ...router,
                            x: e.target.x(),
                            y: e.target.y(),
                        }
                    })
                }}
              >
                 <Circle
                    radius={15}
                    fill={selectedId === router.id ? '#00ff00' : '#00aa00'}
                    stroke="#000"
                    strokeWidth={1}
                 />
                 <Text
                    text={router.ssid}
                    y={20}
                    align="center"
                    fontSize={12}
                    fill="#000"
                    offsetX={router.ssid.length * 3}
                 />
                 <Circle radius={3} fill="#fff" />
              </Group>
          ))}

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
