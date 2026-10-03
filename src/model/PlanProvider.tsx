import React from "react";
import type { ReactNode } from "react";
import { PlanContext, planReducer, initialPlan } from "./PlanContext";
import { useUndoRedoReducer } from "./history";

export const PlanProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useUndoRedoReducer(
    planReducer,
    initialPlan,
  );

  return (
    <PlanContext.Provider
      value={{
        plan: state.present,
        dispatch,
        undo,
        redo,
        canUndo,
        canRedo,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
};
