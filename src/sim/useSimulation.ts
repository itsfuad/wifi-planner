import { useState, useEffect, useRef, useCallback } from 'react';
import type { FloorPlan } from '../model/types';
import type { SimulationResponse, SimulationRequest } from './worker';

export const useSimulation = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (e: MessageEvent<SimulationResponse>) => {
      setResult(e.data);
      setIsSimulating(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runSimulation = useCallback((plan: FloorPlan, resolution: number = 20) => {
    if (workerRef.current) {
      setIsSimulating(true);
      const request: SimulationRequest = { plan, resolution };
      workerRef.current.postMessage(request);
    }
  }, []);

  return { isSimulating, result, runSimulation };
};
