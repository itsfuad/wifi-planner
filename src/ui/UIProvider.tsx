import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { UIContext } from './UIContext';
import type { Tool } from './UIContext';

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [scale, setScale] = useState(1);
  const [gridSize, setGridSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simulationResolution, setSimulationResolution] = useState(20);

  return (
    <UIContext.Provider
      value={{
        activeTool,
        setActiveTool,
        scale,
        setScale,
        gridSize,
        setGridSize,
        selectedId,
        setSelectedId,
        simulationResolution,
        setSimulationResolution,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};
