import React from 'react';
import { useUI } from './UIContext';
import type { Tool } from './UIContext';
import { MousePointer2, BrickWall, DoorOpen, Square, Wifi } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useUI();

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
    </div>
  );
};
