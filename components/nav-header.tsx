"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import { ProfileDropdown } from "@/components/profile-dropdown";

export function NavHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#F9FAFB]/95 shadow-sm">
      <div className="flex items-center justify-between px-5 py-3.5 lg:px-8">
        {/* Logo — visible only on mobile (sidebar has it on md+) */}
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-extrabold text-[#111827] md:hidden">
          <Radio className="h-5 w-5 text-[#7C3AED]" />
          <span className="font-[family-name:var(--font-montserrat)]">WaveCast</span>
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
