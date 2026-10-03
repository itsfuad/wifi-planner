import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorPlan } from "../model/types";
import type { SimulationRequest, SimulationResponse } from "./worker";

export const useSimulation = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const generationRef = useRef(0);

  const createWorker = useCallback((generation: number) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<SimulationResponse>) => {
      if (generation !== generationRef.current) return;
      setResult(event.data);
      setError(null);
      setIsSimulating(false);
    };
    worker.onerror = () => {
      if (generation === generationRef.current) {
        setError(
          "Coverage analysis failed. Check the plan dimensions and try again.",
        );
        setIsSimulating(false);
      }
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const runSimulation = useCallback(
    (plan: FloorPlan, resolution = 20, revision?: string) => {
      // A live edit can arrive before the previous grid finishes. Terminating the
      // stale worker prevents a backlog where the heatmap visibly trails the plan.
      workerRef.current?.terminate();
      const generation = ++generationRef.current;
      const worker = createWorker(generation);
      setError(null);
      setIsSimulating(true);
      const request: SimulationRequest = { plan, resolution, revision };
      worker.postMessage(request);
    },
    [createWorker],
  );

  return { isSimulating, result, error, runSimulation };
};
