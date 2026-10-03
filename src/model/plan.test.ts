import { describe, expect, it } from "vitest";
import { planReducer } from "./PlanContext";
import { parsePlan } from "./validation";
import type { FloorPlan, Wall } from "./types";

const wall: Wall = {
  id: "wall",
  p1: { x: 0, y: 0 },
  p2: { x: 400, y: 0 },
  thickness: 15,
  material: "brick",
};
const plan: FloorPlan = {
  id: "plan",
  width: 1000,
  height: 800,
  walls: [wall],
  doors: [
    { id: "door", wallId: "wall", distance: 300, width: 80, type: "wood" },
  ],
  obstacles: [],
  routers: [],
};

describe("plan invariants", () => {
  it("keeps doors inside a shortened wall", () => {
    const next = planReducer(plan, {
      type: "UPDATE_WALL",
      payload: { ...wall, p2: { x: 200, y: 0 } },
    });
    expect(next.doors[0].distance).toBe(160);
    expect(next.doors[0].width).toBe(80);
  });

  it("rejects incomplete plans before they reach rendering", () => {
    const parsed = parsePlan({
      id: "broken",
      width: 100,
      height: 100,
      walls: [],
      routers: [],
    });
    expect(parsed.plan).toBeNull();
    expect(parsed.error).toContain("doors");
  });

  it("migrates the documented legacy mesh flag", () => {
    const parsed = parsePlan({
      id: "legacy",
      width: 100,
      height: 100,
      walls: [],
      doors: [],
      obstacles: [],
      routers: [
        {
          id: "router",
          x: 50,
          y: 50,
          txPower: 20,
          band: 5,
          gain: 2,
          ssid: "Home",
          isMesh: false,
          meshParentId: null,
        },
      ],
    });
    expect(parsed.error).toBeNull();
    expect(parsed.plan?.routers[0].mode).toBe("solo");
    expect(parsed.plan?.routers[0].backhaulBand).toBe(5);
  });
});
