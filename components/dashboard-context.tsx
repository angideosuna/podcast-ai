"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type DashboardTab = "hoy" | "historial" | "descubrir" | "universo" | "perfil";

interface DashboardContextValue {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTabState] = useState<DashboardTab>("hoy");

  const setActiveTab = useCallback((tab: DashboardTab) => {
    setActiveTabState(tab);
  }, []);

  return (
    <DashboardContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
