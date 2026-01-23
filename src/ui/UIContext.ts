import { createContext, useContext } from 'react';

export type Tool = 'select' | 'wall' | 'door' | 'obstacle' | 'router';

export interface UIContextType {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  scale: number;
  setScale: (scale: number) => void;
  gridSize: number; // in cm (pixels)
  setGridSize: (size: number) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  simulationResolution: number;
  setSimulationResolution: (res: number) => void;
}

export const UIContext = createContext<UIContextType>({
  activeTool: 'select',
  setActiveTool: () => {},
  scale: 1,
  setScale: () => {},
  gridSize: 50, // 50 cm
  setGridSize: () => {},
  selectedId: null,
  setSelectedId: () => {},
  simulationResolution: 20,
  setSimulationResolution: () => {},
});

export const useUI = () => useContext(UIContext);
