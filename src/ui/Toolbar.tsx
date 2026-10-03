import React, { useContext } from "react";
import {
  Box,
  BrickWall,
  DoorOpen,
  MousePointer2,
  Redo2,
  SquareDashed,
  Undo2,
  Wifi,
} from "lucide-react";
import { PlanContext } from "../model/PlanContext";
import { useUI, type Tool } from "./UIContext";
const tools: Array<{
  id: Tool;
  icon: React.ReactNode;
  label: string;
  hint: string;
  key: string;
}> = [
  {
    id: "select",
    icon: <MousePointer2 size={18} />,
    label: "Select",
    hint: "Move and resize objects",
    key: "V",
  },
  {
    id: "room",
    icon: <SquareDashed size={18} />,
    label: "Room",
    hint: "Create a rectangular room",
    key: "R",
  },
  {
    id: "wall",
    icon: <BrickWall size={18} />,
    label: "Wall",
    hint: "Draw connected wall segments",
    key: "W",
  },
  {
    id: "door",
    icon: <DoorOpen size={18} />,
    label: "Door",
    hint: "Place a door on a wall",
    key: "D",
  },
  {
    id: "obstacle",
    icon: <Box size={18} />,
    label: "Object",
    hint: "Add furniture or obstacles",
    key: "O",
  },
  {
    id: "router",
    icon: <Wifi size={18} />,
    label: "Access point",
    hint: "Place Wi-Fi hardware",
    key: "A",
  },
];
export const Toolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useUI();
  const { undo, redo, canUndo, canRedo } = useContext(PlanContext);
  return (
    <aside className="toolbar">
      <div className="toolbar-section-label">Create</div>
      <div className="toolbar-tools">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tool-button ${activeTool === t.id ? "active" : ""}`}
            onClick={() => setActiveTool(t.id)}
            title={`${t.label} — ${t.hint} (${t.key})`}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-copy">
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </span>
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section-label">History</div>
      <div className="toolbar-history">
        <button
          className="icon-button"
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo2 size={18} />
        </button>
        <button
          className="icon-button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
        >
          <Redo2 size={18} />
        </button>
      </div>
    </aside>
  );
};
