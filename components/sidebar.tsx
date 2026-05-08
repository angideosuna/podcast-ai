"use client";

import Link from "next/link";
import { Radio, Home, Search, Globe, Clock, User, Plus } from "lucide-react";
import { useDashboard, type DashboardTab } from "@/components/dashboard-context";
import { ProfileDropdown } from "@/components/profile-dropdown";

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
    <aside className="hidden md:flex md:w-[72px] lg:w-[240px] flex-col border-r border-[#E5E7EB] bg-gradient-to-b from-[#7C3AED]/5 to-white h-screen shrink-0 transition-all duration-300">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 lg:px-5">
        <Radio className="h-6 w-6 shrink-0 text-[#7C3AED]" />
        <span className="hidden lg:inline text-lg font-extrabold text-[#111827] font-[family-name:var(--font-montserrat)]">
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-[#7C3AED]/10 text-[#7C3AED]"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* CTA button */}
      <div className="px-2 lg:px-3 mb-4">
        <button
          onClick={() => setActiveTab("universo")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-3 py-2.5 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-[#6D28D9] cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline">Crear DeepCast</span>
        </button>
      </div>

      {/* Profile at bottom */}
      <div className="border-t border-[#E5E7EB] px-2 lg:px-3 py-3">
        <button
          onClick={() => setActiveTab("perfil")}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 cursor-pointer ${
            activeTab === "perfil"
              ? "bg-[#7C3AED]/10 text-[#7C3AED]"
              : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          }`}
        >
          <User className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline">Mi Perfil</span>
        </button>
      </div>
    </aside>
  );
}
