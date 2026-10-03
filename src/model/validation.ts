import {
  BackhaulType,
  DoorType,
  ObstacleType,
  RouterMode,
  WallMaterial,
} from "./types";
import type { Door, FloorPlan, Obstacle, Router, Wall } from "./types";

const MAX_PLAN_SIZE = 100_000;

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const isOneOf = <T>(value: unknown, values: readonly T[]): value is T =>
  values.includes(value as T);
const point = (value: unknown): value is { x: number; y: number } =>
  isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
const boundedDimension = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0 && value <= MAX_PLAN_SIZE;

const wallMaterials = Object.values(WallMaterial);
const doorTypes = Object.values(DoorType);
const obstacleTypes = Object.values(ObstacleType);
const routerModes = Object.values(RouterMode);
const backhaulTypes = Object.values(BackhaulType);
const bands = [2.4, 5, 6] as const;

const validId = (value: unknown, ids: Set<string>): value is string =>
  isString(value) && !ids.has(value);

const parseWall = (value: unknown, ids: Set<string>): Wall | null => {
  if (!isRecord(value)) return null;
  const { id, p1, p2, thickness, material } = value;
  if (
    !validId(id, ids) ||
    !point(p1) ||
    !point(p2) ||
    !isFiniteNumber(thickness) ||
    thickness <= 0 ||
    thickness > 1000 ||
    !isOneOf(material, wallMaterials)
  )
    return null;
  ids.add(id);
  return { id, p1, p2, thickness, material };
};

const parseDoor = (value: unknown, ids: Set<string>): Door | null => {
  if (!isRecord(value)) return null;
  const { id, wallId, distance, width, type } = value;
  if (
    !validId(id, ids) ||
    !isString(wallId) ||
    !isFiniteNumber(distance) ||
    distance < 0 ||
    !isFiniteNumber(width) ||
    width <= 0 ||
    !isOneOf(type, doorTypes)
  )
    return null;
  ids.add(id);
  return { id, wallId, distance, width, type };
};

const parseObstacle = (value: unknown, ids: Set<string>): Obstacle | null => {
  if (!isRecord(value)) return null;
  const { id, x, y, width, height, rotation, type, label } = value;
  if (
    !validId(id, ids) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !boundedDimension(width) ||
    !boundedDimension(height) ||
    !isFiniteNumber(rotation) ||
    !isOneOf(type, obstacleTypes) ||
    typeof label !== "string"
  )
    return null;
  ids.add(id);
  return {
    id,
    x: x as number,
    y: y as number,
    width,
    height,
    rotation,
    type,
    label,
  };
};

const parseRouter = (value: unknown, ids: Set<string>): Router | null => {
  if (!isRecord(value)) return null;
  const id = value.id;
  if (!validId(id, ids)) return null;
  const legacyMode =
    value.isMesh === true ? RouterMode.MeshNode : RouterMode.Solo;
  const mode = value.mode ?? legacyMode;
  const backhaulType = value.backhaulType ?? BackhaulType.Wireless;
  const backhaulBand =
    value.backhaulBand === undefined
      ? isOneOf(value.band, bands)
        ? value.band
        : null
      : value.backhaulBand;
  const { x, y, txPower, gain, band, ssid, meshParentId } = value;
  if (
    !validId(id, ids) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(txPower) ||
    !isFiniteNumber(gain) ||
    !isString(ssid)
  )
    return null;
  if (
    !isOneOf(band, bands) ||
    !isOneOf(mode, routerModes) ||
    !isOneOf(backhaulType, backhaulTypes)
  )
    return null;
  if (backhaulBand !== null && !isOneOf(backhaulBand, bands)) return null;
  if (
    meshParentId !== null &&
    meshParentId !== undefined &&
    !isString(meshParentId)
  )
    return null;
  const normalizedParentId = isString(meshParentId) ? meshParentId : null;
  ids.add(id);
  return {
    id,
    x,
    y,
    txPower,
    band,
    gain,
    ssid,
    mode,
    meshParentId: normalizedParentId,
    backhaulType,
    backhaulBand,
  };
};

export interface PlanParseResult {
  plan: FloorPlan | null;
  error: string | null;
}

export const parsePlan = (value: unknown): PlanParseResult => {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !boundedDimension(value.width) ||
    !boundedDimension(value.height)
  ) {
    return {
      plan: null,
      error: "Plan must contain a valid id, width, and height.",
    };
  }
  if (
    !Array.isArray(value.walls) ||
    !Array.isArray(value.doors) ||
    !Array.isArray(value.obstacles) ||
    !Array.isArray(value.routers)
  ) {
    return {
      plan: null,
      error: "Plan must contain walls, doors, obstacles, and routers arrays.",
    };
  }
  const { id, width, height } = value;

  const ids = new Set<string>();
  const walls = value.walls.map((item) => parseWall(item, ids));
  const doors = value.doors.map((item) => parseDoor(item, ids));
  const obstacles = value.obstacles.map((item) => parseObstacle(item, ids));
  const routers = value.routers.map((item) => parseRouter(item, ids));
  if (
    walls.some((item) => !item) ||
    doors.some((item) => !item) ||
    obstacles.some((item) => !item) ||
    routers.some((item) => !item)
  ) {
    return {
      plan: null,
      error: "Plan contains an invalid or duplicate entity.",
    };
  }

  const wallIds = new Set(walls.map((wall) => wall!.id));
  const routerIds = new Set(routers.map((router) => router!.id));
  if (doors.some((door) => !wallIds.has(door!.wallId)))
    return {
      plan: null,
      error: "Plan contains a door attached to a missing wall.",
    };
  if (
    routers.some(
      (router) =>
        router!.mode === RouterMode.MeshNode &&
        router!.meshParentId !== null &&
        !routerIds.has(router!.meshParentId),
    )
  ) {
    return {
      plan: null,
      error: "Plan contains a mesh node attached to a missing access point.",
    };
  }

  return {
    plan: {
      id,
      width,
      height,
      walls: walls as Wall[],
      doors: doors as Door[],
      obstacles: obstacles as Obstacle[],
      routers: routers as Router[],
    },
    error: null,
  };
};

export const parseStoredPlan = (serialized: string | null): PlanParseResult => {
  if (!serialized) return { plan: null, error: null };
  try {
    return parsePlan(JSON.parse(serialized));
  } catch {
    return { plan: null, error: "Saved plan is not valid JSON." };
  }
};
