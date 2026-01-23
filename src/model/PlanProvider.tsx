import React, { useReducer } from 'react';
import type { ReactNode } from 'react';
import { PlanContext, planReducer, initialPlan } from './PlanContext';

export const PlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [plan, dispatch] = useReducer(planReducer, initialPlan);

  return <PlanContext.Provider value={{ plan, dispatch }}>{children}</PlanContext.Provider>;
};
