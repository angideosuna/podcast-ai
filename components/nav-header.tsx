"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import { ProfileDropdown } from "@/components/profile-dropdown";

export function NavHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/30 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-3.5 lg:px-8">
        {/* Logo — visible only on mobile (sidebar has it on md+) */}
        <Link href="/dashboard" className="flex items-center gap-2.5 text-lg text-[#1A1614] md:hidden">
          <Radio className="h-5 w-5 text-[#E07856]" strokeWidth={1.5} />
          <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}>
            WaveCast
          </span>
        </Link>

        {/* Spacer on desktop */}
        <div className="hidden md:block" />

        {/* Right side: profile */}
        <div className="flex items-center gap-2">
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}
