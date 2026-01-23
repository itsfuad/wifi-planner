import { Toolbar } from './ui/Toolbar';
import { EditorCanvas } from './ui/EditorCanvas';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { PlanProvider } from './model/PlanProvider';
import { UIProvider } from './ui/UIProvider';
import { useSimulation } from './sim/useSimulation';
import { useContext, useRef } from 'react';
import { PlanContext } from './model/PlanContext';
import { v4 as uuidv4 } from 'uuid';

import { useUI } from './ui/UIContext';

// Wrapper component to access Context
const AppContent = () => {
    const { plan, dispatch } = useContext(PlanContext);
    const { simulationResolution } = useUI();
    const { isSimulating, result, runSimulation } = useSimulation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRunSimulation = () => {
        runSimulation(plan, simulationResolution);
    };

    const handleNew = () => {
        if (confirm('Are you sure you want to create a new plan? Unsaved changes will be lost.')) {
            dispatch({
                type: 'SET_PLAN',
                payload: {
                    id: uuidv4(),
                    width: 2000,
                    height: 1500,
                    walls: [],
                    doors: [],
                    obstacles: [],
                    routers: []
                }
            });
        }
    };

    const handleSave = () => {
        try {
            localStorage.setItem('wifi-plan', JSON.stringify(plan));
            alert('Plan saved to local storage.');
        } catch (e) {
            console.error(e);
            alert('Failed to save to local storage.');
        }
    };

    const handleLoad = () => {
        try {
            const saved = localStorage.getItem('wifi-plan');
            if (saved) {
                dispatch({ type: 'SET_PLAN', payload: JSON.parse(saved) });
                alert('Plan loaded from local storage.');
            } else {
                alert('No saved plan found.');
            }
        } catch (e) {
             console.error(e);
             alert('Failed to load.');
        }
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'floorplan.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = ev.target?.result as string;
                const importedPlan = JSON.parse(content);
                // Basic validation
                if (importedPlan.id && Array.isArray(importedPlan.walls)) {
                    dispatch({ type: 'SET_PLAN', payload: importedPlan });
                    alert('Plan imported successfully.');
                } else {
                    alert('Invalid file format.');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to parse JSON.');
            }
        };
        reader.readAsText(file);
        // Reset
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
      <div className="app-container">
        <div className="top-bar">
          <h1>Wi-Fi Planner</h1>
          <button onClick={handleNew}>New</button>
          <button onClick={handleSave}>Save (Local)</button>
          <button onClick={handleLoad}>Load (Local)</button>
          <button onClick={handleExport}>Export JSON</button>
          <button onClick={handleImportClick}>Import JSON</button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleFileChange}
          />
          <div style={{ flex: 1 }}></div>
          <button onClick={handleRunSimulation} disabled={isSimulating}>
            {isSimulating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
        <div className="main-content">
          <Toolbar />
          <EditorCanvas simulationResult={result} />
          <PropertiesPanel />
        </div>
      </div>
    );
}

function App() {
  return (
    <PlanProvider>
      <UIProvider>
         <AppContent />
      </UIProvider>
    </PlanProvider>
  );
}

export default App;
