"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth-utils";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export function NavHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="text-xl font-bold text-white">
          WaveCast
        </Link>

        {/* Desktop logout */}
        <button
          onClick={handleLogout}
          className="hidden cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-light transition-all duration-300 hover:bg-red-500/10 hover:text-red-400 sm:flex"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>

        {/* Menu hamburguesa mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="cursor-pointer rounded-xl p-2 text-muted transition-all duration-300 hover:bg-forest/10 hover:text-forest sm:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Nav mobile */}
      {menuOpen && (
        <nav className="border-t border-white/[0.08] px-4 py-2 sm:hidden">
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-all duration-300 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </nav>
      )}
    </header>
  );
}
