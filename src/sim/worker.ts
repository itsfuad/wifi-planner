import { calculateSignalStrength } from './physics';
import type { FloorPlan } from '../model/types';

export interface SimulationRequest {
  plan: FloorPlan;
  resolution: number; // in cm
}

export interface SimulationResponse {
  data: Float32Array; // Flattened array [rssi, rssi, ...]
  width: number;
  height: number;
  resolution: number;
  minRSSI: number;
  maxRSSI: number;
}

self.onmessage = (e: MessageEvent<SimulationRequest>) => {
  const { plan, resolution } = e.data;
  const width = Math.ceil(plan.width / resolution);
  const height = Math.ceil(plan.height / resolution);

  const data = new Float32Array(width * height);
  let minRSSI = Infinity;
  let maxRSSI = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x * resolution;
      const py = y * resolution;

      let maxSignal = -120; // Default noise floor

      if (plan.routers.length === 0) {
          maxSignal = -120;
      } else {
        for (const router of plan.routers) {
             const freq = router.band === 2.4 ? 2400 : router.band === 5 ? 5200 : 6000;
             const sig = calculateSignalStrength(
                 router.txPower,
                 router.gain,
                 freq,
                 { x: router.x, y: router.y },
                 { x: px, y: py },
                 plan.walls,
                 plan.doors,
                 plan.obstacles
             );
             if (sig > maxSignal) maxSignal = sig;
        }
      }

      if (maxSignal < -120) maxSignal = -120;
      // Track min/max for visualization scaling
      if (maxSignal > -100) {
          if (maxSignal < minRSSI) minRSSI = maxSignal;
          if (maxSignal > maxRSSI) maxRSSI = maxSignal;
      }

      data[y * width + x] = maxSignal;
    }
  }

  if (minRSSI === Infinity) minRSSI = -90;
  if (maxRSSI === -Infinity) maxRSSI = -30;

  const response: SimulationResponse = {
    data,
    width,
    height,
    resolution,
    minRSSI,
    maxRSSI
  };

  self.postMessage(response);
};
