import type { Point, Wall, Door, Obstacle } from '../model/types';
import { WALL_ATTENUATION, DOOR_ATTENUATION, OBSTACLE_ATTENUATION } from '../model/constants';
import { distance } from '../utils/math';

// FSPL in dB for distance in meters and frequency in MHz
export const calculateFSPL = (distanceMeters: number, frequencyMHz: number): number => {
  if (distanceMeters <= 0.1) return 0; // Close proximity
  // FSPL = 20log10(d) + 20log10(f) - 27.55
  return 20 * Math.log10(distanceMeters) + 20 * Math.log10(frequencyMHz) - 27.55;
};

// Line segment intersection
// Returns null if no intersection, or the point of intersection
export const getIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
  if (det === 0) return null; // Parallel

  const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
  const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

  if (0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1) {
    return {
      x: p1.x + lambda * (p2.x - p1.x),
      y: p1.y + lambda * (p2.y - p1.y),
    };
  }
  return null;
};

// Check if a point on a wall is within a door
export const getDoorAtPoint = (wall: Wall, point: Point, doors: Door[]): Door | null => {
  const wallDoors = doors.filter(d => d.wallId === wall.id);
  if (wallDoors.length === 0) return null;

  const distFromP1 = distance(wall.p1, point);

  for (const door of wallDoors) {
    // Check if distFromP1 is within [door.distance - door.width/2, door.distance + door.width/2]
    if (distFromP1 >= door.distance - door.width / 2 && distFromP1 <= door.distance + door.width / 2) {
      return door;
    }
  }
  return null;
};

// Check intersection with rotated rectangle (obstacle)
export const intersectsObstacle = (p1: Point, p2: Point, obstacle: Obstacle): boolean => {
    // Transform p to local space of obstacle
    const angleRad = -obstacle.rotation * (Math.PI / 180); // Negative to undo rotation
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const transform = (p: Point) => {
        const dx = p.x - obstacle.x;
        const dy = p.y - obstacle.y;
        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
    };

    const lp1 = transform(p1);
    const lp2 = transform(p2);

    // Check intersection with rectangle (0, 0, width, height) in local space

    const corners = [
        {x: 0, y: 0},
        {x: obstacle.width, y: 0},
        {x: obstacle.width, y: obstacle.height},
        {x: 0, y: obstacle.height}
    ];

    // Check if line intersects any of the 4 sides
    for (let i = 0; i < 4; i++) {
        const c1 = corners[i];
        const c2 = corners[(i + 1) % 4];
        if (getIntersection(lp1, lp2, c1, c2)) return true;
    }

    // Check if line is fully inside (unlikely for ray from router, but possible if router inside)
    // or if obstacle is fully inside line (impossible)
    const isInside = (p: Point) => p.x >= 0 && p.x <= obstacle.width && p.y >= 0 && p.y <= obstacle.height;
    if (isInside(lp1) || isInside(lp2)) return true;

    return false;
};

export const calculateSignalStrength = (
  txPower: number, // dBm
  gain: number, // dBi
  freqMHz: number,
  routerPos: Point,
  targetPos: Point,
  walls: Wall[],
  doors: Door[],
  obstacles: Obstacle[]
): number => {
  const d = distance(routerPos, targetPos); // distance in units (cm)
  const d_meters = d / 100; // Convert cm to meters

  if (d_meters === 0) return txPower + gain;

  const fspl = calculateFSPL(d_meters, freqMHz);

  let attenuation = 0;

  // Check Walls and Doors
  for (const wall of walls) {
      const intersection = getIntersection(routerPos, targetPos, wall.p1, wall.p2);
      if (intersection) {
          // Check if it's a door
          const door = getDoorAtPoint(wall, intersection, doors);
          if (door) {
              attenuation += DOOR_ATTENUATION[door.type];
          } else {
              attenuation += WALL_ATTENUATION[wall.material];
          }
      }
  }

  // Check Obstacles
  for (const obs of obstacles) {
      if (intersectsObstacle(routerPos, targetPos, obs)) {
          attenuation += OBSTACLE_ATTENUATION[obs.type];
      }
  }

  return txPower + gain - fspl - attenuation;
};
