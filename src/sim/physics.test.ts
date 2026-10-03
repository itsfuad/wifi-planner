import { describe, expect, it } from "vitest";
import { calculateSignalStrength } from "./physics";
import type { Wall } from "../model/types";

const firstHalf: Wall = {
  id: "a",
  p1: { x: 500, y: 0 },
  p2: { x: 500, y: 500 },
  thickness: 15,
  material: "brick",
};
const secondHalf: Wall = {
  id: "b",
  p1: { x: 500, y: 500 },
  p2: { x: 500, y: 1000 },
  thickness: 15,
  material: "brick",
};
const signal = (walls: Wall[]) =>
  calculateSignalStrength(
    20,
    2,
    5200,
    { x: 100, y: 500 },
    { x: 900, y: 500 },
    walls,
    [],
    [],
  );

describe("RF wall intersections", () => {
  it("does not double-count a wall split at the ray crossing", () => {
    const oneWall: Wall = {
      id: "whole",
      p1: { x: 500, y: 0 },
      p2: { x: 500, y: 1000 },
      thickness: 15,
      material: "brick",
    };
    expect(signal([firstHalf, secondHalf])).toBeCloseTo(signal([oneWall]), 5);
  });
});
