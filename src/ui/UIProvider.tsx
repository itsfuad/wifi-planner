import React, { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { UIContext } from './UIContext';
import type { Tool } from './UIContext';

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [scale, setScale] = useState(1);
  const [gridSize, setGridSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [simulationResolution, setSimulationResolution] = useState(20);

  const toggleSelection = useCallback((id: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) {
              next.delete(id);
          } else {
              next.add(id);
          }
          return next;
      });
  }, []);

  const clearSelection = useCallback(() => {
      setSelectedIds(new Set());
  }, []);

  return (
    <UIContext.Provider
      value={{
        activeTool,
        setActiveTool,
        scale,
        setScale,
        gridSize,
        setGridSize,
        selectedIds,
        setSelectedIds,
        toggleSelection,
        clearSelection,
        simulationResolution,
        setSimulationResolution,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};
