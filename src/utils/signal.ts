import { getBackhaulRSSI } from "../sim/mesh";
import type { FloorPlan } from "../model/types";

// A helper to calculate backhaul quality
export const calculateBackhaulRSSI = (nodeId: string, plan: FloorPlan) => {
  const node = plan.routers.find((r) => r.id === nodeId);
  if (!node || !node.meshParentId) return -120;

  const parent = plan.routers.find((r) => r.id === node.meshParentId);
  if (!parent) return -120;

  return getBackhaulRSSI(node, parent, plan);
};

export const getSignalQualityColor = (rssi: number) => {
  if (rssi >= -60) return "#00ff00"; // Excellent
  if (rssi >= -70) return "#aaaa00"; // Good
  if (rssi >= -80) return "#ffaa00"; // Fair
  return "#ff0000"; // Poor
};
