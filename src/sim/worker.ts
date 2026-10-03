import type { FloorPlan } from "../model/types";
import { calculateSignalStrength } from "./physics";
import {
  getMaxMeshHops,
  getMeshCapacityLimitedCount,
  getMeshHealth,
} from "./mesh";
import { estimateThroughputMbps } from "./quality";

export interface SimulationRequest {
  plan: FloorPlan;
  resolution: number;
  revision?: string;
}

export interface SimulationStats {
  excellentPercent: number;
  goodPercent: number;
  fairPercent: number;
  poorPercent: number;
  deadPercent: number;
  averageRSSI: number;
  medianRSSI: number;
  p10RSSI: number;
  medianThroughputMbps: number;
  medianUsableThroughputMbps: number;
  coveragePercent: number;
  usableCoveragePercent: number;
  meshIssueCount: number;
  meshCapacityLimitedCount: number;
  maxMeshHops: number;
  computedCells: number;
  durationMs: number;
}

export interface SimulationResponse {
  data: Float32Array;
  width: number;
  height: number;
  resolution: number;
  revision?: string;
  planId: string;
  minRSSI: number;
  maxRSSI: number;
  stats: SimulationStats;
}

const percentile = (
  values: number[],
  percentileValue: number,
  fallback: number,
) =>
  values.length
    ? values[
        Math.max(
          0,
          Math.min(
            values.length - 1,
            Math.floor((values.length - 1) * percentileValue),
          ),
        )
      ]
    : fallback;

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const started = performance.now();
  const { plan, revision } = event.data;
  const resolution = Math.max(
    5,
    Math.min(200, Math.round(event.data.resolution)),
  );
  const width = Math.ceil(plan.width / resolution);
  const height = Math.ceil(plan.height / resolution);
  if (width * height > 4_000_000)
    throw new Error("Simulation area is too large at this resolution.");

  const data = new Float32Array(width * height);
  const samples: number[] = [];
  const rates: number[] = [];
  const usableRates: number[] = [];
  const meshHealth = getMeshHealth(plan);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let excellent = 0;
  let good = 0;
  let fair = 0;
  let poor = 0;
  let dead = 0;
  let usableCoverage = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = Math.min(plan.width, x * resolution + resolution / 2);
      const py = Math.min(plan.height, y * resolution + resolution / 2);
      let best = -120;
      let bestBand: 2.4 | 5 | 6 = 5;
      let bestUsable = -120;
      let bestUsableBand: 2.4 | 5 | 6 = 5;
      let bestUsableRate = 0;

      for (const router of plan.routers) {
        const frequency =
          router.band === 2.4 ? 2400 : router.band === 5 ? 5200 : 6100;
        const signal = calculateSignalStrength(
          router.txPower,
          router.gain,
          frequency,
          router,
          { x: px, y: py },
          plan.walls,
          plan.doors,
          plan.obstacles,
        );
        if (signal > best) {
          best = signal;
          bestBand = router.band;
        }
        const health = meshHealth.get(router.id);
        if (health?.connected && signal > bestUsable) {
          bestUsable = signal;
          bestUsableBand = router.band;
          bestUsableRate = Math.min(
            estimateThroughputMbps(signal, router.band),
            health.capacityMbps,
          );
        }
      }

      best = Math.max(-120, Math.min(-20, best));
      bestUsable = Math.max(-120, Math.min(-20, bestUsable));
      data[y * width + x] = best;
      samples.push(best);
      rates.push(estimateThroughputMbps(best, bestBand));
      usableRates.push(
        bestUsableRate || estimateThroughputMbps(bestUsable, bestUsableBand),
      );
      sum += best;
      min = Math.min(min, best);
      max = Math.max(max, best);
      if (best >= -55) excellent += 1;
      else if (best >= -67) good += 1;
      else if (best >= -75) fair += 1;
      else if (best >= -85) poor += 1;
      else dead += 1;
      if (bestUsable >= -75) usableCoverage += 1;
    }
  }

  samples.sort((a, b) => a - b);
  rates.sort((a, b) => a - b);
  usableRates.sort((a, b) => a - b);
  const total = Math.max(1, samples.length);
  const response: SimulationResponse = {
    data,
    width,
    height,
    resolution,
    revision,
    planId: plan.id,
    minRSSI: Number.isFinite(min) ? min : -120,
    maxRSSI: Number.isFinite(max) ? max : -120,
    stats: {
      excellentPercent: (excellent / total) * 100,
      goodPercent: (good / total) * 100,
      fairPercent: (fair / total) * 100,
      poorPercent: (poor / total) * 100,
      deadPercent: (dead / total) * 100,
      averageRSSI: sum / total,
      medianRSSI: percentile(samples, 0.5, -120),
      p10RSSI: percentile(samples, 0.1, -120),
      medianThroughputMbps: percentile(rates, 0.5, 0),
      medianUsableThroughputMbps: percentile(usableRates, 0.5, 0),
      coveragePercent: ((excellent + good + fair) / total) * 100,
      usableCoveragePercent: (usableCoverage / total) * 100,
      meshIssueCount: [...meshHealth.values()].filter(
        (value) => !value.connected,
      ).length,
      meshCapacityLimitedCount: getMeshCapacityLimitedCount(plan, meshHealth),
      maxMeshHops: getMaxMeshHops(plan, meshHealth),
      computedCells: total,
      durationMs: performance.now() - started,
    },
  };
  self.postMessage(response, { transfer: [data.buffer] });
};
