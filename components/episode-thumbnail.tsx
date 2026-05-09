"use client";

import { useState } from "react";
import {
  Cpu,
  TrendingUp,
  Atom,
  Landmark,
  Palette,
  Heart,
  Search,
  Compass,
  Radio,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { getTopicById } from "@/lib/topics";

// ─── Category → gradient + icon mapping ─────────────────────

const CATEGORY_GRADIENTS: Record<string, string> = {
  tecnologia: "from-[#E07856] to-[#C96A4A]",
  ciencia: "from-[#9B7B8E] to-[#8A6A7D]",
  "negocios-finanzas": "from-[#D4A574] to-[#C4956A]",
  entretenimiento: "from-[#D4A574] to-[#9B7B8E]",
  "salud-bienestar": "from-[#A8C4A0] to-[#9B7B8E]",
  "sociedad-cultura": "from-[#D4A574] to-[#C96A4A]",
  "true-crime-misterio": "from-[#6B5D54] to-[#1A1614]",
  lifestyle: "from-[#D4A574] to-[#E07856]",
  custom: "from-[#E07856] to-[#D4A574]",
  "weekly-digest": "from-[#E07856] to-[#9B7B8E]",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  tecnologia: Cpu,
  ciencia: Atom,
  "negocios-finanzas": TrendingUp,
  entretenimiento: Palette,
  "salud-bienestar": Heart,
  "sociedad-cultura": Landmark,
  "true-crime-misterio": Search,
  lifestyle: Compass,
  custom: Radio,
  "weekly-digest": BookOpen,
};

// ─── Component ──────────────────────────────────────────────

interface EpisodeThumbnailProps {
  topics: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
  coverImageUrl?: string;
}

const SIZES = { sm: "w-14 h-14", md: "w-20 h-20", lg: "w-32 h-32" };
const ICON_SIZES = { sm: 20, md: 28, lg: 40 };

export function EpisodeThumbnail({ topics, size = "md", className, coverImageUrl }: EpisodeThumbnailProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Resolve category from first topic
  let categoryId = "custom";
  if (topics.includes("weekly-digest")) {
    categoryId = "weekly-digest";
  } else if (topics.length > 0) {
    const topic = getTopicById(topics[0]);
    if (topic) categoryId = topic.categoryId;
  }

  const gradient = CATEGORY_GRADIENTS[categoryId] || "from-[#9B8E84] to-[#6B5D54]";
  const Icon = CATEGORY_ICONS[categoryId] || Radio;
  const showCover = coverImageUrl && !imgError;

  return (
    <div
      className={`${SIZES[size]} flex-shrink-0 rounded-2xl bg-gradient-to-br ${gradient} relative flex items-center justify-center overflow-hidden ${className || ""}`}
    >
      {/* Dot pattern overlay (z-0 layer) */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      <Icon size={ICON_SIZES[size]} className="relative z-[1] text-white/80" strokeWidth={1.5} />

      {/* Cover image overlay */}
      {showCover && (
        <img
          src={coverImageUrl}
          alt=""
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 z-[5] h-full w-full object-cover transition-opacity duration-500 ease-out ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
