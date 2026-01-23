import type { Point } from '../model/types';

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getNearestPointOnSegment = (p1: Point, p2: Point, p: Point): Point => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return p1;

  const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy);

  if (t < 0) return p1;
  if (t > 1) return p2;

  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  };
};
