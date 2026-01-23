import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { FloorPlan, Wall, Door, Obstacle, Router } from './types';
import { v4 as uuidv4 } from 'uuid';

// Initial State
export const initialPlan: FloorPlan = {
  id: uuidv4(),
  width: 2000, // Default 20m width (assuming 1 unit = 1 cm)
  height: 1500, // Default 15m height
  walls: [],
  doors: [],
  obstacles: [],
  routers: [],
};

// Actions
export type Action =
  | { type: 'SET_PLAN'; payload: FloorPlan }
  | { type: 'ADD_WALL'; payload: Wall }
  | { type: 'UPDATE_WALL'; payload: Wall }
  | { type: 'DELETE_WALL'; payload: string }
  | { type: 'ADD_OBSTACLE'; payload: Obstacle }
  | { type: 'UPDATE_OBSTACLE'; payload: Obstacle }
  | { type: 'DELETE_OBSTACLE'; payload: string }
  | { type: 'ADD_DOOR'; payload: Door }
  | { type: 'UPDATE_DOOR'; payload: Door }
  | { type: 'DELETE_DOOR'; payload: string }
  | { type: 'ADD_ROUTER'; payload: Router }
  | { type: 'UPDATE_ROUTER'; payload: Router }
  | { type: 'DELETE_ROUTER'; payload: string };

// Reducer
export const planReducer = (state: FloorPlan, action: Action): FloorPlan => {
  switch (action.type) {
    case 'SET_PLAN':
      return action.payload;
    case 'ADD_WALL':
      return { ...state, walls: [...state.walls, action.payload] };
    case 'UPDATE_WALL':
      return {
        ...state,
        walls: state.walls.map((w) => (w.id === action.payload.id ? action.payload : w)),
      };
    case 'DELETE_WALL':
      return {
        ...state,
        walls: state.walls.filter((w) => w.id !== action.payload),
        doors: state.doors.filter((d) => d.wallId !== action.payload), // Cascade delete doors
      };
    case 'ADD_OBSTACLE':
      return { ...state, obstacles: [...state.obstacles, action.payload] };
    case 'UPDATE_OBSTACLE':
      return {
        ...state,
        obstacles: state.obstacles.map((o) => (o.id === action.payload.id ? action.payload : o)),
      };
    case 'DELETE_OBSTACLE':
      return {
        ...state,
        obstacles: state.obstacles.filter((o) => o.id !== action.payload),
      };
    case 'ADD_DOOR':
      return { ...state, doors: [...state.doors, action.payload] };
    case 'UPDATE_DOOR':
      return {
        ...state,
        doors: state.doors.map((d) => (d.id === action.payload.id ? action.payload : d)),
      };
    case 'DELETE_DOOR':
      return {
        ...state,
        doors: state.doors.filter((d) => d.id !== action.payload),
      };
    case 'ADD_ROUTER':
      return { ...state, routers: [...state.routers, action.payload] };
    case 'UPDATE_ROUTER':
      return {
        ...state,
        routers: state.routers.map((r) => (r.id === action.payload.id ? action.payload : r)),
      };
    case 'DELETE_ROUTER':
      return {
        ...state,
        routers: state.routers.filter((r) => r.id !== action.payload),
      };
    default:
      return state;
  }
};

// Context
interface PlanContextType {
  plan: FloorPlan;
  dispatch: Dispatch<Action>;
}

export const PlanContext = createContext<PlanContextType>({
  plan: initialPlan,
  dispatch: () => null,
});
