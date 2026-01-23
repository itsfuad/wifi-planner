export interface Point {
  x: number;
  y: number;
}

export const WallMaterial = {
  Drywall: 'drywall',
  Brick: 'brick',
  Concrete: 'concrete',
  Glass: 'glass',
} as const;

export type WallMaterial = (typeof WallMaterial)[keyof typeof WallMaterial];

export interface Wall {
  id: string;
  p1: Point;
  p2: Point;
  thickness: number; // cm
  material: WallMaterial;
}

export const DoorType = {
  Wood: 'wood',
  Glass: 'glass',
  Metal: 'metal',
} as const;

export type DoorType = (typeof DoorType)[keyof typeof DoorType];

export interface Door {
  id: string;
  wallId: string;
  distance: number; // distance from p1
  width: number; // cm
  type: DoorType;
}

export const ObstacleType = {
  Bed: 'bed',
  Sofa: 'sofa',
  Table: 'table',
  Wardrobe: 'wardrobe',
  Fridge: 'fridge',
  Oven: 'oven',
  Generic: 'generic',
} as const;

export type ObstacleType = (typeof ObstacleType)[keyof typeof ObstacleType];

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  type: ObstacleType;
  label: string;
}

export interface Router {
  id: string;
  x: number;
  y: number;
  txPower: number; // dBm
  band: 2.4 | 5 | 6; // GHz
  gain: number; // dBi
  ssid: string;
  isMesh: boolean;
  meshParentId: string | null;
}

export interface FloorPlan {
  id: string;
  width: number;
  height: number;
  walls: Wall[];
  doors: Door[];
  obstacles: Obstacle[];
  routers: Router[];
}
