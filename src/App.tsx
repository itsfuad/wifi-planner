import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import {
  ChevronDown,
  Download,
  FolderOpen,
  Play,
  Save,
  Upload,
  Wifi,
} from "lucide-react";
import { PlanContext } from "./model/PlanContext";
import type { FloorPlan } from "./model/types";
import { parseStoredPlan, parsePlan } from "./model/validation";
import { PlanProvider } from "./model/PlanProvider";
import { planTemplates } from "./model/templates";
import { useSimulation } from "./sim/useSimulation";
import { EditorCanvas } from "./ui/EditorCanvas";
import { PropertiesPanel } from "./ui/PropertiesPanel";
import { SimulationPanel } from "./ui/SimulationPanel";
import { Toolbar } from "./ui/Toolbar";
import { useUI, type Tool } from "./ui/UIContext";
import { UIProvider } from "./ui/UIProvider";

const STORAGE_KEY = "wifi-planner-v2";
const TOOL_BY_KEY: Record<string, Tool> = {
  v: "select",
  r: "room",
  w: "wall",
  d: "door",
  o: "obstacle",
  a: "router",
};

const AppContent = () => {
  const { plan, dispatch, undo, redo } = useContext(PlanContext);
  const {
    activeTool,
    setActiveTool,
    clearSelection,
    liveSimulation,
    simulationResolution,
    scale,
  } = useUI();
  const {
    isSimulating,
    result,
    error: simulationError,
    runSimulation,
  } = useSimulation();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const planRevision = useMemo(() => JSON.stringify(plan), [plan]);

  const run = useCallback(() => {
    if (plan.routers.length)
      runSimulation(plan, simulationResolution, planRevision);
  }, [plan, planRevision, runSimulation, simulationResolution]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const parsed = parseStoredPlan(
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("wifi-plan"),
    );
    if (parsed.plan) dispatch({ type: "SET_PLAN", payload: parsed.plan });
    if (parsed.error)
      setNotice(`Could not restore saved plan: ${parsed.error}`);
    setHydrated(true);
  }, [dispatch]);

  useEffect(() => {
    if (!liveSimulation) return;
    const timer = setTimeout(run, 240);
    return () => clearTimeout(timer);
  }, [liveSimulation, run]);

  useEffect(() => {
    if (!hydrated) return;
    setSaving(true);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch {
        setNotice("Could not save locally. Export the plan to keep a backup.");
      } finally {
        setSaving(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [hydrated, plan]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element && ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const tool = TOOL_BY_KEY[event.key.toLowerCase()];
        if (tool) setActiveTool(tool);
      }
      if (event.key === "Escape") {
        setActiveTool("select");
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, redo, setActiveTool, undo]);

  const selectTemplate = (create: () => FloorPlan) => {
    dispatch({ type: "SET_PLAN", payload: create() });
    clearSelection();
    setActiveTool("select");
    setMenu(false);
    setNotice(null);
  };

  const load = () => {
    const parsed = parseStoredPlan(
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("wifi-plan"),
    );
    if (parsed.plan) {
      dispatch({ type: "SET_PLAN", payload: parsed.plan });
      clearSelection();
      setNotice(null);
    } else {
      setNotice(parsed.error ?? "No saved plan found.");
    }
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      setNotice(null);
    } catch {
      setNotice("Could not save locally. Export the plan to keep a backup.");
    }
  };

  const exportPlan = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wifi-plan.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importPlan = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parsePlan(JSON.parse(String(reader.result)));
        if (!parsed.plan) {
          setNotice(`Import rejected: ${parsed.error ?? "invalid plan"}`);
        } else {
          dispatch({ type: "SET_PLAN", payload: parsed.plan });
          clearSelection();
          setNotice(null);
        }
      } catch {
        setNotice("Import rejected: the file is not valid JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const currentResult =
    result?.planId === plan.id && result.revision === planRevision
      ? result
      : null;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Wifi size={18} />
          </span>
          <div>
            <strong>AirPlan</strong>
            <span>Wi-Fi workspace</span>
          </div>
        </div>
        <div className="top-divider" />
        <div className="template-control">
          <button
            className="header-button project-button"
            onClick={() => setMenu((open) => !open)}
            aria-expanded={menu}
          >
            Floor plan <ChevronDown size={15} />
          </button>
          {menu ? (
            <div className="template-menu">
              <div className="menu-label">Start from a layout</div>
              {planTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template.create)}
                >
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {notice ? (
          <span className="app-notice" role="status">
            {notice}
          </span>
        ) : null}
        <div className="header-actions">
          <span className="save-indicator">
            <span className={saving ? "saving" : ""} />
            {saving ? "Saving…" : "Saved locally"}
          </span>
          <button
            className="icon-button header-icon"
            onClick={load}
            title="Open local"
            aria-label="Open local"
          >
            <FolderOpen size={17} />
          </button>
          <button
            className="icon-button header-icon"
            onClick={save}
            title="Save"
            aria-label="Save"
          >
            <Save size={17} />
          </button>
          <button
            className="icon-button header-icon"
            onClick={exportPlan}
            title="Export"
            aria-label="Export"
          >
            <Download size={17} />
          </button>
          <button
            className="icon-button header-icon"
            onClick={() => fileRef.current?.click()}
            title="Import"
            aria-label="Import"
          >
            <Upload size={17} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={importPlan}
          />
          <button className="run-button" onClick={run} disabled={isSimulating}>
            <Play size={15} fill="currentColor" />
            {isSimulating ? "Analyzing" : "Analyze"}
          </button>
        </div>
      </header>
      <main className="main-content">
        <Toolbar />
        <section className="workspace-center">
          <EditorCanvas simulationResult={currentResult} />
          <SimulationPanel
            result={plan.routers.length ? result : null}
            isSimulating={isSimulating}
            isStale={!!result && !currentResult}
            error={simulationError}
            onRun={run}
          />
          <div className="workspace-statusbar">
            <span>
              {activeTool === "select"
                ? "Select and inspect"
                : `${activeTool} tool`}
            </span>
            <span>{Math.round(scale * 100)}%</span>
            <span>
              {(plan.width / 100).toFixed(1)} × {(plan.height / 100).toFixed(1)}{" "}
              m
            </span>
            <span>
              {plan.routers.length} AP{plan.routers.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>
        <PropertiesPanel />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <PlanProvider>
      <UIProvider>
        <AppContent />
      </UIProvider>
    </PlanProvider>
  );
}
