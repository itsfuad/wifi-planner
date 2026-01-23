import React, { useContext } from 'react';
import { PlanContext } from '../model/PlanContext';
import { useUI } from './UIContext';
import { WallMaterial, DoorType, ObstacleType } from '../model/types';

export const PropertiesPanel: React.FC = () => {
  const { plan, dispatch } = useContext(PlanContext);
  const { selectedId, simulationResolution, setSimulationResolution } = useUI();

  if (!selectedId) {
    return (
      <div className="properties-panel">
        <h3>Settings</h3>
        <label>
            Simulation Resolution (cm):
            <input
                type="number"
                min="5"
                max="100"
                value={simulationResolution}
                onChange={(e) => setSimulationResolution(Number(e.target.value))}
            />
            <small style={{display: 'block', marginTop: '4px', color: '#666'}}>
                Lower is more detailed but slower.
            </small>
        </label>

        <h3>Properties</h3>
        <p>Select an object to edit properties.</p>
      </div>
    );
  }

  const wall = plan.walls.find((w) => w.id === selectedId);
  const door = plan.doors.find((d) => d.id === selectedId);
  const obstacle = plan.obstacles.find((o) => o.id === selectedId);
  const router = plan.routers.find((r) => r.id === selectedId);

  return (
    <div className="properties-panel">
      <h3>Properties</h3>

      {wall && (
        <div>
          <h4>Wall</h4>
          <label>
            Material:
            <select
              value={wall.material}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_WALL',
                  payload: { ...wall, material: e.target.value as WallMaterial },
                })
              }
            >
              {Object.values(WallMaterial).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
           <br/>
           <label>
              Thickness (cm):
              <input
                type="number"
                value={wall.thickness}
                onChange={(e) => dispatch({ type: 'UPDATE_WALL', payload: { ...wall, thickness: Number(e.target.value) } })}
              />
           </label>
        </div>
      )}

      {door && (
        <div>
          <h4>Door</h4>
          <label>
            Type:
            <select
              value={door.type}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_DOOR',
                  payload: { ...door, type: e.target.value as DoorType },
                })
              }
            >
               {Object.values(DoorType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <br/>
          <label>
              Width (cm):
              <input
                type="number"
                value={door.width}
                onChange={(e) => dispatch({ type: 'UPDATE_DOOR', payload: { ...door, width: Number(e.target.value) } })}
              />
           </label>
        </div>
      )}

      {obstacle && (
        <div>
          <h4>Obstacle</h4>
          <label>
              Label:
              <input
                type="text"
                value={obstacle.label}
                onChange={(e) => dispatch({ type: 'UPDATE_OBSTACLE', payload: { ...obstacle, label: e.target.value } })}
              />
           </label>
           <br/>
          <label>
            Type:
            <select
              value={obstacle.type}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_OBSTACLE',
                  payload: { ...obstacle, type: e.target.value as ObstacleType },
                })
              }
            >
               {Object.values(ObstacleType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <br/>
          <label>
              Width (cm):
              <input
                type="number"
                value={Math.round(obstacle.width)}
                onChange={(e) => dispatch({ type: 'UPDATE_OBSTACLE', payload: { ...obstacle, width: Number(e.target.value) } })}
              />
           </label>
           <br/>
           <label>
              Height (cm):
              <input
                type="number"
                value={Math.round(obstacle.height)}
                onChange={(e) => dispatch({ type: 'UPDATE_OBSTACLE', payload: { ...obstacle, height: Number(e.target.value) } })}
              />
           </label>
           <br/>
           <label>
              Rotation:
              <input
                type="number"
                value={Math.round(obstacle.rotation)}
                onChange={(e) => dispatch({ type: 'UPDATE_OBSTACLE', payload: { ...obstacle, rotation: Number(e.target.value) } })}
              />
           </label>
        </div>
      )}

      {router && (
        <div>
          <h4>Router</h4>
          <label>
              SSID:
              <input
                type="text"
                value={router.ssid}
                onChange={(e) => dispatch({ type: 'UPDATE_ROUTER', payload: { ...router, ssid: e.target.value } })}
              />
           </label>
           <br/>
           <label>
               Tx Power (dBm):
               <input
                type="number"
                value={router.txPower}
                onChange={(e) => dispatch({ type: 'UPDATE_ROUTER', payload: { ...router, txPower: Number(e.target.value) } })}
               />
           </label>
           <br/>
           <label>
               Band (GHz):
               <select
                 value={router.band}
                 onChange={(e) => dispatch({ type: 'UPDATE_ROUTER', payload: { ...router, band: Number(e.target.value) as 2.4 | 5 | 6 } })}
               >
                   <option value={2.4}>2.4</option>
                   <option value={5}>5</option>
                   <option value={6}>6</option>
               </select>
           </label>
           <br/>
           <label>
               Gain (dBi):
               <input
                type="number"
                value={router.gain}
                onChange={(e) => dispatch({ type: 'UPDATE_ROUTER', payload: { ...router, gain: Number(e.target.value) } })}
               />
           </label>
        </div>
      )}
    </div>
  );
};
