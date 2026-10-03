import type { Door, Obstacle, Point, Wall } from "../model/types";
import {
  DOOR_ATTENUATION,
  OBSTACLE_ATTENUATION,
  WALL_ATTENUATION,
} from "../model/constants";
import { distance } from "../utils/math";

export const calculateFSPL = (
  distanceMeters: number,
  frequencyMHz: number,
): number =>
  20 * Math.log10(Math.max(1, distanceMeters)) +
  20 * Math.log10(frequencyMHz) -
  27.55;

const frequencyMultiplier = (frequencyMHz: number) =>
  frequencyMHz >= 5900 ? 1.3 : frequencyMHz >= 4900 ? 1.15 : 1;

export const getIntersection = (
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): Point | null => {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(det) < 0.00001) return null;
  const lambda =
    ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
  const gamma =
    ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
  if (lambda < 0 || lambda > 1 || gamma < 0 || gamma > 1) return null;
  return { x: p1.x + lambda * (p2.x - p1.x), y: p1.y + lambda * (p2.y - p1.y) };
};

export const getDoorAtPoint = (wall: Wall, point: Point, doors: Door[]) => {
  const d = distance(wall.p1, point);
  return (
    doors.find(
      (door) =>
        door.wallId === wall.id &&
        d >= door.distance - door.width / 2 &&
        d <= door.distance + door.width / 2,
    ) ?? null
  );
};

const samePoint = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
const collinearWalls = (a: Wall, b: Wall) => {
  const adx = a.p2.x - a.p1.x;
  const ady = a.p2.y - a.p1.y;
  const bdx = b.p2.x - b.p1.x;
  const bdy = b.p2.y - b.p1.y;
  return Math.abs(adx * bdy - ady * bdx) < 0.01;
};

interface WallHit {
  wall: Wall;
  point: Point;
}

const uniqueWallHits = (hits: WallHit[]) =>
  hits.filter(
    (hit, index) =>
      !hits
        .slice(0, index)
        .some(
          (previous) =>
            samePoint(previous.point, hit.point) &&
            collinearWalls(previous.wall, hit.wall),
        ),
  );

export const intersectsObstacle = (
  p1: Point,
  p2: Point,
  obstacle: Obstacle,
): boolean => {
  const angle = (-obstacle.rotation * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const transform = (p: Point) => {
    const dx = p.x - obstacle.x,
      dy = p.y - obstacle.y;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };
  const a = transform(p1),
    b = transform(p2);
  const corners = [
    { x: 0, y: 0 },
    { x: obstacle.width, y: 0 },
    { x: obstacle.width, y: obstacle.height },
    { x: 0, y: obstacle.height },
  ];
  for (let i = 0; i < 4; i++)
    if (getIntersection(a, b, corners[i], corners[(i + 1) % 4])) return true;
  const inside = (p: Point) =>
    p.x >= 0 && p.x <= obstacle.width && p.y >= 0 && p.y <= obstacle.height;
  return inside(a) || inside(b);
};

export const calculateSignalStrength = (
  txPower: number,
  gain: number,
  freqMHz: number,
  routerPos: Point,
  targetPos: Point,
  walls: Wall[],
  doors: Door[],
  obstacles: Obstacle[],
): number => {
  const meters = Math.max(0.5, distance(routerPos, targetPos) / 100);
  const n = freqMHz >= 5900 ? 2.65 : freqMHz >= 4900 ? 2.5 : 2.35;
  const pathLoss = calculateFSPL(1, freqMHz) + 10 * n * Math.log10(meters);
  const fm = frequencyMultiplier(freqMHz);
  let attenuation = 0;
  const hits = uniqueWallHits(
    walls.flatMap((wall) => {
      const point = getIntersection(routerPos, targetPos, wall.p1, wall.p2);
      return point ? [{ wall, point }] : [];
    }),
  );
  for (const { wall, point } of hits) {
    const door = getDoorAtPoint(wall, point, doors);
    if (door) attenuation += DOOR_ATTENUATION[door.type] * fm;
    else
      attenuation +=
        WALL_ATTENUATION[wall.material] *
        fm *
        Math.max(0.65, Math.sqrt(Math.max(5, wall.thickness) / 15));
  }
  for (const obstacle of obstacles)
    if (intersectsObstacle(routerPos, targetPos, obstacle))
      attenuation += OBSTACLE_ATTENUATION[obstacle.type] * fm;
  return txPower + gain - pathLoss - attenuation;
};
