import { calculateSignalStrength } from "./physics";
import { estimateThroughputMbps } from "./quality";
import { BackhaulType, RouterMode } from "../model/types";
import type { FloorPlan, Router } from "../model/types";

export const getBackhaulRSSI = (
  router: Router,
  parent: Router,
  plan: FloorPlan,
) => {
  if (router.backhaulType === BackhaulType.Wired) return -10;
  const frequency =
    router.backhaulBand === 2.4
      ? 2400
      : router.backhaulBand === 6
        ? 6000
        : 5200;
  return calculateSignalStrength(
    parent.txPower,
    parent.gain,
    frequency,
    parent,
    router,
    plan.walls,
    plan.doors,
    plan.obstacles,
  );
};

export const isRouterConnected = (
  router: Router,
  plan: FloorPlan,
  visiting = new Set<string>(),
): boolean => {
  if (router.mode !== RouterMode.MeshNode) return true;
  if (!router.meshParentId || visiting.has(router.id)) return false;
  const parent = plan.routers.find(
    (candidate) => candidate.id === router.meshParentId,
  );
  if (
    !parent ||
    !isRouterConnected(parent, plan, new Set([...visiting, router.id]))
  )
    return false;
  return (
    router.backhaulType === BackhaulType.Wired ||
    getBackhaulRSSI(router, parent, plan) >= -85
  );
};

export const getMeshIssueCount = (plan: FloorPlan) =>
  plan.routers.filter((router) => !isRouterConnected(router, plan)).length;

export interface MeshHealth {
  connected: boolean;
  rssi: number;
  capacityMbps: number;
  hops: number;
}

const backhaulCapacity = (router: Router, rssi: number) => {
  if (router.backhaulType === BackhaulType.Wired) return Infinity;
  // Wireless backhaul shares airtime with client traffic, so reserve half of
  // the estimated radio rate for forwarding traffic.
  return estimateThroughputMbps(rssi, router.backhaulBand ?? 5) * 0.5;
};

export const getMeshHealth = (plan: FloorPlan): Map<string, MeshHealth> => {
  const health = new Map<string, MeshHealth>();
  const wirelessChildren = new Map<string, number>();
  plan.routers.forEach((router) => {
    if (
      router.mode === RouterMode.MeshNode &&
      router.meshParentId &&
      router.backhaulType === BackhaulType.Wireless
    ) {
      wirelessChildren.set(
        router.meshParentId,
        (wirelessChildren.get(router.meshParentId) ?? 0) + 1,
      );
    }
  });

  const resolve = (router: Router, visiting: Set<string>): MeshHealth => {
    const cached = health.get(router.id);
    if (cached) return cached;
    if (
      visiting.has(router.id) ||
      router.mode !== RouterMode.MeshNode ||
      !router.meshParentId
    ) {
      const rootHealth = {
        connected: router.mode !== RouterMode.MeshNode,
        rssi: -10,
        capacityMbps: Infinity,
        hops: 0,
      };
      health.set(router.id, rootHealth);
      return rootHealth;
    }

    const parent = plan.routers.find(
      (candidate) => candidate.id === router.meshParentId,
    );
    if (!parent) {
      const disconnected = {
        connected: false,
        rssi: -120,
        capacityMbps: 0,
        hops: 0,
      };
      health.set(router.id, disconnected);
      return disconnected;
    }

    const parentHealth = resolve(parent, new Set([...visiting, router.id]));
    const rssi =
      router.backhaulType === BackhaulType.Wired
        ? -10
        : getBackhaulRSSI(router, parent, plan);
    const connected =
      parentHealth.connected &&
      (router.backhaulType === BackhaulType.Wired || rssi >= -85);
    const linkCapacity = connected ? backhaulCapacity(router, rssi) : 0;
    const siblingCount = Math.max(1, wirelessChildren.get(parent.id) ?? 1);
    const sharedCapacity =
      router.backhaulType === BackhaulType.Wired
        ? Math.min(linkCapacity, parentHealth.capacityMbps)
        : Math.min(linkCapacity, parentHealth.capacityMbps) / siblingCount;
    const childHealth = {
      connected,
      rssi,
      capacityMbps: connected ? sharedCapacity : 0,
      hops: connected ? parentHealth.hops + 1 : 0,
    };
    health.set(router.id, childHealth);
    return childHealth;
  };

  plan.routers.forEach((router) => {
    if (router.mode !== RouterMode.MeshNode)
      health.set(router.id, {
        connected: true,
        rssi: -10,
        capacityMbps: Infinity,
        hops: 0,
      });
  });
  plan.routers.forEach((router) => resolve(router, new Set()));
  return health;
};

export const getMeshCapacityLimitedCount = (
  plan: FloorPlan,
  health = getMeshHealth(plan),
) =>
  plan.routers.filter(
    (router) =>
      router.mode === RouterMode.MeshNode &&
      health.get(router.id)?.connected &&
      Number.isFinite(health.get(router.id)?.capacityMbps),
  ).length;

export const getMaxMeshHops = (plan: FloorPlan, health = getMeshHealth(plan)) =>
  Math.max(
    0,
    ...plan.routers.map((router) => health.get(router.id)?.hops ?? 0),
  );
