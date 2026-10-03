import React, { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { UIContext, type Tool } from "./UIContext";
export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [scale, setScale] = useState(0.75);
  const [gridSize, setGridSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [simulationResolution, setSimulationResolution] = useState(20);
  const [showGrid, setShowGrid] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.56);
  const [liveSimulation, setLiveSimulation] = useState(true);
  const toggleSelection = useCallback(
    (id: string) =>
      setSelectedIds((p) => {
        const n = new Set(p);
        if (n.has(id)) {
          n.delete(id);
        } else {
          n.add(id);
        }
        return n;
      }),
    [],
  );
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
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
        showGrid,
        setShowGrid,
        showHeatmap,
        setShowHeatmap,
        heatmapOpacity,
        setHeatmapOpacity,
        liveSimulation,
        setLiveSimulation,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};
