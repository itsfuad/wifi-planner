import type { Door, Wall } from "./types";

export const wallLength = (wall: Wall) =>
  Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);

export const clampDoorToWall = (door: Door, wall: Wall): Door => {
  const length = wallLength(wall);
  const width = Math.min(Math.max(1, door.width), length);
  const half = width / 2;
  return {
    ...door,
    width,
    distance: length
      ? Math.max(half, Math.min(length - half, door.distance))
      : 0,
  };
};

export const clampDoorsToWalls = (doors: Door[], walls: Wall[]) => {
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));
  return doors.map((door) => {
    const wall = wallById.get(door.wallId);
    return wall ? clampDoorToWall(door, wall) : door;
  });
};
