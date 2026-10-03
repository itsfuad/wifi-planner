import { useReducer, useCallback } from "react";

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export type HistoryAction<T, A> =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_HISTORY"; payload: HistoryState<T> }
  | A; // Regular actions

const createHistoryReducer = <T, A extends { type: string }>(
  reducer: (state: T, action: A) => T,
) => {
  return (
    state: HistoryState<T>,
    action: HistoryAction<T, A>,
  ): HistoryState<T> => {
    const { past, present, future } = state;

    switch (action.type) {
      case "UNDO": {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        return {
          past: newPast,
          present: previous,
          future: [present, ...future],
        };
      }
      case "REDO": {
        if (future.length === 0) return state;
        const next = future[0];
        const newFuture = future.slice(1);
        return {
          past: [...past, present],
          present: next,
          future: newFuture,
        };
      }
      case "SET_HISTORY":
        return (action as { type: "SET_HISTORY"; payload: HistoryState<T> })
          .payload;
      default: {
        const newPresent = reducer(present, action as A);
        if (newPresent === present) return state;
        return {
          past: [...past, present],
          present: newPresent,
          future: [],
        };
      }
    }
  };
};

export const useUndoRedoReducer = <T, A extends { type: string }>(
  reducer: (state: T, action: A) => T,
  initialState: T,
) => {
  const historyReducer = createHistoryReducer(reducer);
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return { state, dispatch, undo, redo, canUndo, canRedo };
};
