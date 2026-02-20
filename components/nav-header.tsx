"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth-utils";
import {
  LayoutDashboard,
  History,
  Settings,
  User,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/onboarding", label: "Preferencias", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/30 bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="text-xl font-bold font-serif">
          <span className="text-forest">PodCast</span>
          <span className="text-muted-light">.ai</span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-forest/10 text-forest"
                    : "text-muted hover:bg-forest/5 hover:text-forest"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="ml-2 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-light transition-all duration-300 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>

        {/* Menu hamburguesa mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="cursor-pointer rounded-xl p-2 text-muted transition-all duration-300 hover:bg-forest/10 hover:text-forest sm:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Nav mobile */}
      {menuOpen && (
        <nav className="border-t border-white/30 px-4 py-2 sm:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-forest/10 text-forest"
                    : "text-muted hover:bg-forest/5 hover:text-forest"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-300 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </button>
        </nav>
      )}
    </header>
  );
}
