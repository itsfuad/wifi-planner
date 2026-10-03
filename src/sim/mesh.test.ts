import { describe, expect, it } from "vitest";
import {
  getMeshCapacityLimitedCount,
  getMeshHealth,
  getMeshIssueCount,
  isRouterConnected,
} from "./mesh";
import type { FloorPlan, Router } from "../model/types";

const router = (
  id: string,
  mode: Router["mode"],
  meshParentId: string | null,
): Router => ({
  id,
  x: id === "root" ? 100 : 900,
  y: 500,
  txPower: 20,
  band: 5,
  gain: 2,
  ssid: id,
  mode,
  meshParentId,
  backhaulType: "wireless",
  backhaulBand: 5,
});

describe("mesh connectivity", () => {
  it("marks a node with a missing parent as disconnected", () => {
    const plan: FloorPlan = {
      id: "plan",
      width: 1000,
      height: 1000,
      walls: [],
      doors: [],
      obstacles: [],
      routers: [router("node", "mesh_node", "missing")],
    };
    expect(isRouterConnected(plan.routers[0], plan)).toBe(false);
    expect(getMeshIssueCount(plan)).toBe(1);
  });

  it("accepts a reachable wireless child", () => {
    const root = router("root", "mesh_root", null);
    const node = router("node", "mesh_node", "root");
    const plan: FloorPlan = {
      id: "plan",
      width: 1000,
      height: 1000,
      walls: [],
      doors: [],
      obstacles: [],
      routers: [root, node],
    };
    expect(isRouterConnected(node, plan)).toBe(true);
    expect(getMeshIssueCount(plan)).toBe(0);
  });

  it("shares wireless parent capacity across sibling nodes", () => {
    const root = router("root", "mesh_root", null);
    const first = router("first", "mesh_node", "root");
    const second = router("second", "mesh_node", "root");
    const oneChildPlan: FloorPlan = {
      id: "one-child",
      width: 1000,
      height: 1000,
      walls: [],
      doors: [],
      obstacles: [],
      routers: [root, first],
    };
    const twoChildPlan = {
      ...oneChildPlan,
      id: "two-child",
      routers: [root, first, second],
    };
    const oneChildCapacity =
      getMeshHealth(oneChildPlan).get("first")?.capacityMbps ?? 0;
    const twoChildHealth = getMeshHealth(twoChildPlan);
    expect(twoChildHealth.get("first")?.capacityMbps).toBeLessThan(
      oneChildCapacity,
    );
    expect(twoChildHealth.get("first")?.capacityMbps).toBe(
      twoChildHealth.get("second")?.capacityMbps,
    );
    expect(getMeshCapacityLimitedCount(twoChildPlan)).toBe(2);
  });
});
