import React, { useContext } from 'react';
import { useUI } from './UIContext';
import { PlanContext } from '../model/PlanContext';
import type { Tool } from './UIContext';
import { MousePointer2, BrickWall, DoorOpen, Square, Wifi, Undo, Redo } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useUI();
  const { undo, redo, canUndo, canRedo } = useContext(PlanContext);

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 size={24} />, label: 'Select' },
    { id: 'wall', icon: <BrickWall size={24} />, label: 'Wall' },
    { id: 'door', icon: <DoorOpen size={24} />, label: 'Door' },
    { id: 'obstacle', icon: <Square size={24} />, label: 'Obstacle' },
    { id: 'router', icon: <Wifi size={24} />, label: 'Router' },
  ];

  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={activeTool === tool.id ? 'active' : ''}
          onClick={() => setActiveTool(tool.id)}
          title={tool.label}
          style={{
             backgroundColor: activeTool === tool.id ? '#ddd' : 'transparent',
             border: 'none',
             borderRadius: '4px',
             padding: '8px',
             cursor: 'pointer',
             color: activeTool === tool.id ? '#000' : '#666'
          }}
        >
          {tool.icon}
        </button>
      ))}

      <div style={{ height: '1px', width: '80%', backgroundColor: '#ccc', margin: '8px 0' }}></div>

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{
             backgroundColor: 'transparent',
             border: 'none',
             padding: '8px',
             cursor: canUndo ? 'pointer' : 'not-allowed',
             color: canUndo ? '#000' : '#ccc'
        }}
      >
          <Undo size={24} />
      </button>

      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={{
             backgroundColor: 'transparent',
             border: 'none',
             padding: '8px',
             cursor: canRedo ? 'pointer' : 'not-allowed',
             color: canRedo ? '#000' : '#ccc'
        }}
      >
          <Redo size={24} />
      </button>
    </div>
  );
};
