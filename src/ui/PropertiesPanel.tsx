import React, { useContext } from "react";
import { Eye, Grid3X3, Radio, SlidersHorizontal } from "lucide-react";
import { PlanContext } from "../model/PlanContext";
import {
  BackhaulType,
  DoorType,
  ObstacleType,
  RouterMode,
  WallMaterial,
} from "../model/types";
import { useUI } from "./UIContext";
const Field = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);
const Head = ({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) => (
  <div className="inspector-heading">
    <span className="inspector-heading-icon">{icon}</span>
    <div>
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
    </div>
  </div>
);

const readNumber = (value: string, min = -Infinity, max = Infinity) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
};
export const PropertiesPanel: React.FC = () => {
  const { plan, dispatch } = useContext(PlanContext);
  const u = useUI();
  const entities = [
    ...plan.walls.map((item) => ({
      id: item.id,
      label: "Wall",
      detail: item.material,
    })),
    ...plan.doors.map((item) => ({
      id: item.id,
      label: "Door",
      detail: item.type,
    })),
    ...plan.obstacles.map((item) => ({
      id: item.id,
      label: item.label || "Object",
      detail: item.type,
    })),
    ...plan.routers.map((item) => ({
      id: item.id,
      label: item.ssid || "Access point",
      detail: `${item.band} GHz`,
    })),
  ];
  if (!u.selectedIds.size)
    return (
      <aside className="properties-panel">
        <Head
          icon={<SlidersHorizontal size={17} />}
          title="Workspace"
          subtitle="Planning and analysis controls"
        />
        <div className="inspector-section">
          <div className="section-kicker">
            <Grid3X3 size={14} /> Design grid
          </div>
          <Field label="Grid spacing">
            <select
              value={u.gridSize}
              onChange={(e) => u.setGridSize(+e.target.value)}
            >
              <option value={25}>25 cm</option>
              <option value={50}>50 cm</option>
              <option value={100}>1 m</option>
            </select>
          </Field>
          <label className="toggle-row">
            <div>
              <strong>Show grid</strong>
              <small>Alignment guides</small>
            </div>
            <input
              type="checkbox"
              checked={u.showGrid}
              onChange={(e) => u.setShowGrid(e.target.checked)}
            />
          </label>
        </div>
        <div className="inspector-section">
          <div className="section-kicker">
            <Radio size={14} /> RF simulation
          </div>
          <label className="toggle-row">
            <div>
              <strong>Live analysis</strong>
              <small>Recalculate after changes</small>
            </div>
            <input
              type="checkbox"
              checked={u.liveSimulation}
              onChange={(e) => u.setLiveSimulation(e.target.checked)}
            />
          </label>
          <label className="toggle-row">
            <div>
              <strong>Coverage heatmap</strong>
              <small>Show signal overlay</small>
            </div>
            <input
              type="checkbox"
              checked={u.showHeatmap}
              onChange={(e) => u.setShowHeatmap(e.target.checked)}
            />
          </label>
          <Field label="Simulation detail">
            <select
              value={u.simulationResolution}
              onChange={(e) => u.setSimulationResolution(+e.target.value)}
            >
              <option value={12}>Ultra · 12 cm</option>
              <option value={20}>High · 20 cm</option>
              <option value={30}>Balanced · 30 cm</option>
              <option value={50}>Fast · 50 cm</option>
            </select>
          </Field>
          <Field label="Heatmap opacity">
            <div className="range-field">
              <input
                type="range"
                min=".15"
                max=".85"
                step=".05"
                value={u.heatmapOpacity}
                onChange={(e) => u.setHeatmapOpacity(+e.target.value)}
              />
              <span>{Math.round(u.heatmapOpacity * 100)}%</span>
            </div>
          </Field>
        </div>
        <div className="inspector-section compact">
          <div className="section-kicker">
            <Eye size={14} /> Plan
          </div>
          <div className="plan-facts">
            <div>
              <span>Canvas</span>
              <strong>
                {(plan.width / 100).toFixed(1)} ×{" "}
                {(plan.height / 100).toFixed(1)} m
              </strong>
            </div>
            <div>
              <span>Walls</span>
              <strong>{plan.walls.length}</strong>
            </div>
            <div>
              <span>Access points</span>
              <strong>{plan.routers.length}</strong>
            </div>
            <div>
              <span>Objects</span>
              <strong>{plan.obstacles.length}</strong>
            </div>
          </div>
        </div>
        {entities.length ? (
          <div className="inspector-section compact">
            <div className="section-kicker">Plan objects</div>
            <div className="entity-list" aria-label="Plan objects">
              {entities.map((entity) => (
                <button
                  type="button"
                  key={entity.id}
                  className="entity-list-item"
                  onClick={() => {
                    u.setSelectedIds(new Set([entity.id]));
                    u.setActiveTool("select");
                  }}
                >
                  <strong>{entity.label}</strong>
                  <small>{entity.detail}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    );
  if (u.selectedIds.size > 1) {
    const ids = [...u.selectedIds],
      walls = plan.walls.filter((x) => u.selectedIds.has(x.id)),
      doors = plan.doors.filter((x) => u.selectedIds.has(x.id)),
      objects = plan.obstacles.filter((x) => u.selectedIds.has(x.id)),
      routers = plan.routers.filter((x) => u.selectedIds.has(x.id));
    return (
      <aside className="properties-panel">
        <Head
          icon={<SlidersHorizontal size={17} />}
          title={`${u.selectedIds.size} items selected`}
          subtitle="Selection moves as one unit"
        />
        <div className="inspector-section compact">
          <div className="section-kicker">Selection</div>
          <div className="plan-facts">
            {walls.length ? (
              <div>
                <span>Walls</span>
                <strong>{walls.length}</strong>
              </div>
            ) : null}
            {doors.length ? (
              <div>
                <span>Doors</span>
                <strong>{doors.length}</strong>
              </div>
            ) : null}
            {objects.length ? (
              <div>
                <span>Objects</span>
                <strong>{objects.length}</strong>
              </div>
            ) : null}
            {routers.length ? (
              <div>
                <span>Access points</span>
                <strong>{routers.length}</strong>
              </div>
            ) : null}
          </div>
          {walls.length === ids.length ? (
            <>
              <Field label="Wall material">
                <select
                  value={
                    walls.every((x) => x.material === walls[0].material)
                      ? walls[0].material
                      : ""
                  }
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_WALLS",
                      payload: walls.map((w) => ({
                        ...w,
                        material: e.target.value as WallMaterial,
                      })),
                    })
                  }
                >
                  <option value="" disabled>
                    Mixed
                  </option>
                  {Object.values(WallMaterial).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Thickness">
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="5"
                    value={
                      walls.every((x) => x.thickness === walls[0].thickness)
                        ? walls[0].thickness
                        : ""
                    }
                    placeholder="Mixed"
                    onChange={(e) => {
                      const v = readNumber(e.target.value, 5, 1000);
                      if (v !== null)
                        dispatch({
                          type: "UPDATE_WALLS",
                          payload: walls.map((w) => ({ ...w, thickness: v })),
                        });
                    }}
                  />
                  <span>cm</span>
                </div>
              </Field>
            </>
          ) : null}
          <div className="selection-actions">
            <button onClick={() => u.clearSelection()}>Clear</button>
            <button
              className="danger"
              onClick={() => {
                dispatch({ type: "DELETE_ENTITIES", payload: ids });
                u.clearSelection();
              }}
            >
              Delete selection
            </button>
          </div>
        </div>
        <div className="empty-inspector">
          Drag any selected item to move the whole selection. Arrow keys nudge
          10 cm, Shift + Arrow snaps by one grid step, and Ctrl/Cmd + D
          duplicates.
        </div>
      </aside>
    );
  }
  const id = [...u.selectedIds][0],
    wall = plan.walls.find((x) => x.id === id),
    door = plan.doors.find((x) => x.id === id),
    obs = plan.obstacles.find((x) => x.id === id),
    router = plan.routers.find((x) => x.id === id);
  return (
    <aside className="properties-panel">
      {wall && (
        <>
          <Head
            icon={<SlidersHorizontal size={17} />}
            title="Wall"
            subtitle="RF attenuation surface"
          />
          <div className="inspector-section">
            <Field label="Material">
              <select
                value={wall.material}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_WALL",
                    payload: {
                      ...wall,
                      material: e.target.value as WallMaterial,
                    },
                  })
                }
              >
                {Object.values(WallMaterial).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Thickness">
              <div className="input-with-unit">
                <input
                  type="number"
                  min="5"
                  value={wall.thickness}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_WALL",
                      payload: {
                        ...wall,
                        thickness:
                          readNumber(e.target.value, 5, 1000) ?? wall.thickness,
                      },
                    })
                  }
                />
                <span>cm</span>
              </div>
            </Field>
          </div>
        </>
      )}
      {door && (
        <>
          <Head
            icon={<SlidersHorizontal size={17} />}
            title="Door"
            subtitle="Opening material"
          />
          <div className="inspector-section">
            <Field label="Material">
              <select
                value={door.type}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_DOOR",
                    payload: { ...door, type: e.target.value as DoorType },
                  })
                }
              >
                {Object.values(DoorType).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Width">
              <div className="input-with-unit">
                <input
                  type="number"
                  value={Math.round(door.width)}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_DOOR",
                      payload: {
                        ...door,
                        width:
                          readNumber(e.target.value, 1, 100000) ?? door.width,
                      },
                    })
                  }
                />
                <span>cm</span>
              </div>
            </Field>
          </div>
        </>
      )}
      {obs && (
        <>
          <Head
            icon={<SlidersHorizontal size={17} />}
            title={obs.label || "Object"}
            subtitle="Furniture and obstruction"
          />
          <div className="inspector-section">
            <Field label="Label">
              <input
                value={obs.label}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_OBSTACLE",
                    payload: { ...obs, label: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Type">
              <select
                value={obs.type}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_OBSTACLE",
                    payload: { ...obs, type: e.target.value as ObstacleType },
                  })
                }
              >
                {Object.values(ObstacleType).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <div className="two-fields">
              <Field label="Width">
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={Math.round(obs.width)}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_OBSTACLE",
                        payload: {
                          ...obs,
                          width:
                            readNumber(e.target.value, 1, 100000) ?? obs.width,
                        },
                      })
                    }
                  />
                  <span>cm</span>
                </div>
              </Field>
              <Field label="Height">
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={Math.round(obs.height)}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_OBSTACLE",
                        payload: {
                          ...obs,
                          height:
                            readNumber(e.target.value, 1, 100000) ?? obs.height,
                        },
                      })
                    }
                  />
                  <span>cm</span>
                </div>
              </Field>
            </div>
            <Field label="Rotation">
              <div className="input-with-unit">
                <input
                  type="number"
                  value={Math.round(obs.rotation)}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_OBSTACLE",
                      payload: {
                        ...obs,
                        rotation:
                          readNumber(e.target.value, -360, 360) ?? obs.rotation,
                      },
                    })
                  }
                />
                <span>°</span>
              </div>
            </Field>
          </div>
        </>
      )}
      {router && (
        <>
          <Head
            icon={<Radio size={17} />}
            title={router.ssid || "Access point"}
            subtitle="Wireless radio configuration"
          />
          <div className="inspector-section">
            <Field label="SSID">
              <input
                value={router.ssid}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_ROUTER",
                    payload: { ...router, ssid: e.target.value },
                  })
                }
              />
            </Field>
            <div className="two-fields">
              <Field label="Band">
                <select
                  value={router.band}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_ROUTER",
                      payload: {
                        ...router,
                        band: +e.target.value as 2.4 | 5 | 6,
                      },
                    })
                  }
                >
                  <option value={2.4}>2.4 GHz</option>
                  <option value={5}>5 GHz</option>
                  <option value={6}>6 GHz</option>
                </select>
              </Field>
              <Field label="Tx power">
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={router.txPower}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_ROUTER",
                        payload: {
                          ...router,
                          txPower:
                            readNumber(e.target.value, -10, 40) ??
                            router.txPower,
                        },
                      })
                    }
                  />
                  <span>dBm</span>
                </div>
              </Field>
            </div>
            <Field label="Antenna gain">
              <div className="input-with-unit">
                <input
                  type="number"
                  value={router.gain}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_ROUTER",
                      payload: {
                        ...router,
                        gain: readNumber(e.target.value, 0, 30) ?? router.gain,
                      },
                    })
                  }
                />
                <span>dBi</span>
              </div>
            </Field>
            <Field label="Role">
              <select
                value={router.mode}
                onChange={(e) => {
                  const mode = e.target.value as RouterMode;
                  dispatch({
                    type: "UPDATE_ROUTER",
                    payload: {
                      ...router,
                      mode,
                      meshParentId:
                        mode === RouterMode.MeshNode
                          ? router.meshParentId
                          : null,
                    },
                  });
                }}
              >
                <option value={RouterMode.Solo}>Standalone AP</option>
                <option value={RouterMode.MeshRoot}>Mesh root</option>
                <option value={RouterMode.MeshNode}>Mesh satellite</option>
              </select>
            </Field>
            {router.mode === RouterMode.MeshNode && (
              <>
                <Field label="Uplink parent">
                  <select
                    value={router.meshParentId || ""}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_ROUTER",
                        payload: {
                          ...router,
                          meshParentId: e.target.value || null,
                        },
                      })
                    }
                  >
                    <option value="">Select parent</option>
                    {plan.routers
                      .filter(
                        (r) =>
                          r.id !== router.id && r.mode !== RouterMode.MeshNode,
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.ssid}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Backhaul">
                  <select
                    value={router.backhaulType}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_ROUTER",
                        payload: {
                          ...router,
                          backhaulType: e.target.value as BackhaulType,
                        },
                      })
                    }
                  >
                    <option value={BackhaulType.Wireless}>Wireless</option>
                    <option value={BackhaulType.Wired}>Ethernet</option>
                  </select>
                </Field>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
