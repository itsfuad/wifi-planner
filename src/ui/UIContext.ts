import { createContext, useContext } from 'react';

export type Tool = 'select' | 'wall' | 'door' | 'obstacle' | 'router';

export interface UIContextType {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  scale: number;
  setScale: (scale: number) => void;
  gridSize: number; // in cm (pixels)
  setGridSize: (size: number) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  simulationResolution: number;
  setSimulationResolution: (res: number) => void;
}

export const UIContext = createContext<UIContextType>({
  activeTool: 'select',
  setActiveTool: () => {},
  scale: 1,
  setScale: () => {},
  gridSize: 50,
  setGridSize: () => {},
  selectedIds: new Set(),
  setSelectedIds: () => {},
  toggleSelection: () => {},
  clearSelection: () => {},
  simulationResolution: 20,
  setSimulationResolution: () => {},
});

export const useUI = () => useContext(UIContext);
