"use client";

import { Radio, Home, Search, Globe, Clock, User, Plus } from "lucide-react";
import { useDashboard, type DashboardTab } from "@/components/dashboard-context";

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "hoy", label: "Para ti", icon: Home },
  { id: "descubrir", label: "Descubrir", icon: Search },
  { id: "universo", label: "Universo", icon: Globe },
  { id: "historial", label: "Historial", icon: Clock },
];

export function Sidebar() {
  const { activeTab, setActiveTab } = useDashboard();

  return (
    <aside className="hidden md:flex md:w-[72px] lg:w-[240px] flex-col bg-white/30 backdrop-blur-xl h-screen shrink-0 transition-all duration-500 ease-out">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-6 lg:px-5">
        <Radio className="h-6 w-6 shrink-0 text-[#E07856]" strokeWidth={1.5} />
        <span
          className="hidden lg:inline text-lg text-[#1A1614]"
          style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
        >
          WaveCast
        </span>
      </div>

      {/* Nav items */}
      <nav className="mt-2 flex-1 space-y-1 px-2 lg:px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === "hoy" && activeTab === "historial");

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-[14px] font-medium transition-all duration-500 ease-out cursor-pointer ${
                isActive
                  ? "bg-[#E07856]/10 text-[#E07856]"
                  : "text-[#6B5D54] hover:bg-white/40 hover:text-[#1A1614]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* CTA button */}
      <div className="px-2 lg:px-3 mb-4">
        <button
          onClick={() => setActiveTab("universo")}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E07856] px-3 py-2.5 text-[14px] font-medium text-white transition-all duration-500 ease-out hover:bg-[#C96A4A] cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="hidden lg:inline">Crear DeepCast</span>
        </button>
      </div>

      {/* Profile at bottom */}
      <div className="border-t border-[#E8DFD3]/40 px-2 lg:px-3 py-3">
        <button
          onClick={() => setActiveTab("perfil")}
          className={`flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-[14px] font-medium transition-all duration-500 ease-out cursor-pointer ${
            activeTab === "perfil"
              ? "bg-[#E07856]/10 text-[#E07856]"
              : "text-[#6B5D54] hover:bg-white/40 hover:text-[#1A1614]"
          }`}
        >
          <User className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          <span className="hidden lg:inline">Mi Perfil</span>
        </button>
      </div>
    </aside>
  );
}
