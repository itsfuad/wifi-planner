import { WallMaterial, DoorType, ObstacleType } from "./types";

export const WALL_ATTENUATION: Record<WallMaterial, number> = {
  [WallMaterial.Drywall]: 3,
  [WallMaterial.Brick]: 8,
  [WallMaterial.Concrete]: 12,
  [WallMaterial.Glass]: 2, // Assuming standard window glass
};

export const DOOR_ATTENUATION: Record<DoorType, number> = {
  [DoorType.Wood]: 2,
  [DoorType.Glass]: 3,
  [DoorType.Metal]: 10, // Assuming high attenuation for metal
};

// Heuristic values for obstacles (can be tuned)
export const OBSTACLE_ATTENUATION: Record<ObstacleType, number> = {
  [ObstacleType.Bed]: 3,
  [ObstacleType.Sofa]: 3,
  [ObstacleType.Table]: 2,
  [ObstacleType.Wardrobe]: 4,
  [ObstacleType.Fridge]: 10,
  [ObstacleType.Oven]: 10,
  [ObstacleType.Generic]: 3,
};

export const DEFAULT_WALL_THICKNESS = 15; // cm
export const DEFAULT_DOOR_WIDTH = 80; // cm
