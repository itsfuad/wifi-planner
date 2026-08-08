import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { FloorPlan, Wall, Door, Obstacle, Router, Point } from './types';
import { RouterMode } from './types';
import { v4 as uuidv4 } from 'uuid';

// Initial State
export const initialPlan: FloorPlan = {
  id: uuidv4(),
  width: 2000,
  height: 1500,
  walls: [],
  doors: [],
  obstacles: [],
  routers: [],
};

export type Action =
  | { type: 'SET_PLAN'; payload: FloorPlan }
  | { type: 'ADD_WALL'; payload: Wall }
  | { type: 'ADD_WALLS'; payload: Wall[] }
  | { type: 'UPDATE_WALL'; payload: Wall }
  | { type: 'UPDATE_WALLS'; payload: Wall[] }
  | { type: 'DELETE_WALL'; payload: string }
  | { type: 'ADD_OBSTACLE'; payload: Obstacle }
  | { type: 'UPDATE_OBSTACLE'; payload: Obstacle }
  | { type: 'DELETE_OBSTACLE'; payload: string }
  | { type: 'ADD_DOOR'; payload: Door }
  | { type: 'UPDATE_DOOR'; payload: Door }
  | { type: 'DELETE_DOOR'; payload: string }
  | { type: 'ADD_ROUTER'; payload: Router }
  | { type: 'UPDATE_ROUTER'; payload: Router }
  | { type: 'DELETE_ROUTER'; payload: string }
  | { type: 'DELETE_ENTITIES'; payload: string[] }
  | { type: 'TRANSLATE_ENTITIES'; payload: { ids: string[]; dx: number; dy: number } };

const pointKey = (p: Point) => `${p.x},${p.y}`;
const translatePoint = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy });

export const planReducer = (state: FloorPlan, action: Action): FloorPlan => {
  switch (action.type) {
    case 'SET_PLAN':
      return action.payload;
    case 'ADD_WALL':
      return { ...state, walls: [...state.walls, action.payload] };
    case 'ADD_WALLS':
      return { ...state, walls: [...state.walls, ...action.payload] };
    case 'UPDATE_WALL':
      return { ...state, walls: state.walls.map((w) => (w.id === action.payload.id ? action.payload : w)) };
    case 'UPDATE_WALLS': {
      const updates = new Map(action.payload.map((wall) => [wall.id, wall]));
      return { ...state, walls: state.walls.map((wall) => updates.get(wall.id) ?? wall) };
    }
    case 'DELETE_WALL':
      return {
        ...state,
        walls: state.walls.filter((w) => w.id !== action.payload),
        doors: state.doors.filter((d) => d.wallId !== action.payload),
      };
    case 'ADD_OBSTACLE':
      return { ...state, obstacles: [...state.obstacles, action.payload] };
    case 'UPDATE_OBSTACLE':
      return { ...state, obstacles: state.obstacles.map((o) => (o.id === action.payload.id ? action.payload : o)) };
    case 'DELETE_OBSTACLE':
      return { ...state, obstacles: state.obstacles.filter((o) => o.id !== action.payload) };
    case 'ADD_DOOR':
      return { ...state, doors: [...state.doors, action.payload] };
    case 'UPDATE_DOOR':
      return { ...state, doors: state.doors.map((d) => (d.id === action.payload.id ? action.payload : d)) };
    case 'DELETE_DOOR':
      return { ...state, doors: state.doors.filter((d) => d.id !== action.payload) };
    case 'ADD_ROUTER':
      return { ...state, routers: [...state.routers, action.payload] };
    case 'UPDATE_ROUTER':
      return { ...state, routers: state.routers.map((r) => (r.id === action.payload.id ? action.payload : r)) };
    case 'DELETE_ROUTER':
      return { ...state, routers: state.routers.filter((r) => r.id !== action.payload) };
    case 'DELETE_ENTITIES': {
      const ids = new Set(action.payload);
      const deletedWallIds = new Set(state.walls.filter((w) => ids.has(w.id)).map((w) => w.id));
      return {
        ...state,
        walls: state.walls.filter((w) => !ids.has(w.id)),
        obstacles: state.obstacles.filter((o) => !ids.has(o.id)),
        routers: state.routers.filter((r) => !ids.has(r.id)).map((r) => r.meshParentId && ids.has(r.meshParentId) ? { ...r, mode: RouterMode.Solo, meshParentId: null } : r),
        doors: state.doors.filter((d) => !ids.has(d.id) && !deletedWallIds.has(d.wallId)),
      };
    }
    case 'TRANSLATE_ENTITIES': {
      const { dx, dy } = action.payload;
      if (!dx && !dy) return state;
      const ids = new Set(action.payload.ids);
      const selectedWalls = state.walls.filter((w) => ids.has(w.id));
      const movedWallIds = new Set(selectedWalls.map((w) => w.id));
      const endpointMoves = new Map<string, Point>();

      selectedWalls.forEach((wall) => {
        endpointMoves.set(pointKey(wall.p1), translatePoint(wall.p1, dx, dy));
        endpointMoves.set(pointKey(wall.p2), translatePoint(wall.p2, dx, dy));
      });

      const walls = state.walls.map((wall) => {
        if (ids.has(wall.id)) {
          return { ...wall, p1: translatePoint(wall.p1, dx, dy), p2: translatePoint(wall.p2, dx, dy) };
        }
        const movedP1 = endpointMoves.get(pointKey(wall.p1));
        const movedP2 = endpointMoves.get(pointKey(wall.p2));
        if (!movedP1 && !movedP2) return wall;
        return { ...wall, p1: movedP1 ?? wall.p1, p2: movedP2 ?? wall.p2 };
      });

      const doors = state.doors.map((door) => {
        if (!ids.has(door.id) || movedWallIds.has(door.wallId)) return door;
        const wall = state.walls.find((w) => w.id === door.wallId);
        if (!wall) return door;
        const length = Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
        if (!length) return door;
        const ux = (wall.p2.x - wall.p1.x) / length;
        const uy = (wall.p2.y - wall.p1.y) / length;
        const projected = dx * ux + dy * uy;
        const half = Math.max(0, door.width / 2);
        return { ...door, distance: Math.max(half, Math.min(length - half, door.distance + projected)) };
      });

      return {
        ...state,
        walls,
        doors,
        obstacles: state.obstacles.map((o) => ids.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o),
        routers: state.routers.map((r) => ids.has(r.id) ? { ...r, x: r.x + dx, y: r.y + dy } : r),
      };
    }
    default:
      return state;
  }
};

interface PlanContextType {
  plan: FloorPlan;
  dispatch: Dispatch<any>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const PlanContext = createContext<PlanContextType>({
  plan: initialPlan,
  dispatch: () => null,
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
});
