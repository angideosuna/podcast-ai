"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, X, Check, SkipForward, Save, Users, Headphones,
  Brain, Star, Sparkles, Plus, MessageSquare,
} from "lucide-react";
import {
  UNIVERSE_CREATORS, UNIVERSE_PODCASTS, UNIVERSE_DEEP_INTERESTS,
  UNIVERSE_REFERENTS, UNIVERSE_DESCRIPTIONS, UNIVERSE_IMAGES,
  type UniverseItem,
} from "@/lib/universe-catalog";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

type RoundId = "creators" | "podcasts" | "topics" | "referents";

interface Round {
  id: RoundId;
  label: string;
  field: string;
  icon: React.ElementType;
  items: UniverseItem[];
  gradient: string;
  subtitle: string;
}

const ROUNDS: Round[] = [
  { id: "creators", label: "Creadores", field: "fav_creators", icon: Users, items: UNIVERSE_CREATORS, gradient: "from-[#E07856] to-[#C96A4A]", subtitle: "Creador de contenido" },
  { id: "podcasts", label: "Podcasts", field: "fav_podcasts", icon: Headphones, items: UNIVERSE_PODCASTS, gradient: "from-[#D4A574] to-[#C4956A]", subtitle: "Podcast" },
  { id: "topics", label: "Temas", field: "deep_interests", icon: Brain, items: UNIVERSE_DEEP_INTERESTS, gradient: "", subtitle: "" },
  { id: "referents", label: "Referentes", field: "referents", icon: Star, items: UNIVERSE_REFERENTS, gradient: "from-[#9B7B8E] to-[#8A6A7D]", subtitle: "Figura referente" },
];

const TOPIC_GRADIENTS: Record<string, string> = {
  "Tecnología": "from-[#E07856] to-[#C96A4A]",
  "Ciencia": "from-[#9B7B8E] to-[#8A6A7D]",
  "Negocios": "from-[#D4A574] to-[#C4956A]",
  "Cultura": "from-[#D4A574] to-[#9B7B8E]",
  "Salud": "from-[#A8C4A0] to-[#9B7B8E]",
};

const SWIPE_THRESHOLD = 100;

type Selections = Record<string, string[]>;

/* ═══════════════════════════════════════════════════════════════════════════
   SWIPE CARD — manual pointer events + rAF, zero-lag
   ═══════════════════════════════════════════════════════════════════════════ */

function SwipeCard({
  item,
  gradient,
  subtitle,
  onSwiped,
}: {
  item: UniverseItem;
  gradient: string;
  subtitle: string;
  onSwiped: (dir: "left" | "right") => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    fired: false,
  });
  const rafId = useRef(0);
  const [imgError, setImgError] = useState(false);
  const [dragDir, setDragDir] = useState<"left" | "right" | null>(null);

  const imageUrl = UNIVERSE_IMAGES[item.id];
  const showPhoto = imageUrl && !imgError;
  const description = UNIVERSE_DESCRIPTIONS[item.id] || "";

  // Apply transform directly on DOM for zero lag
  const applyTransform = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const { dx, dy, dragging } = state.current;
    const rot = dx * 0.08;
    el.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${rot}deg)`;
    el.style.transition = dragging ? "none" : "transform 0.35s cubic-bezier(.4,0,.2,1)";
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (state.current.fired) return;
    state.current.dragging = true;
    state.current.startX = e.clientX;
    state.current.startY = e.clientY;
    state.current.dx = 0;
    state.current.dy = 0;
    cardRef.current?.setPointerCapture(e.pointerId);
    applyTransform();
  }, [applyTransform]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!state.current.dragging || state.current.fired) return;
    state.current.dx = e.clientX - state.current.startX;
    state.current.dy = e.clientY - state.current.startY;

    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(applyTransform);

    // Update overlay direction
    if (state.current.dx > SWIPE_THRESHOLD) setDragDir("right");
    else if (state.current.dx < -SWIPE_THRESHOLD) setDragDir("left");
    else setDragDir(null);
  }, [applyTransform]);

  const finishSwipe = useCallback((dir: "left" | "right") => {
    state.current.fired = true;
    state.current.dragging = false;
    const flyX = dir === "right" ? 700 : -700;
    state.current.dx = flyX;
    state.current.dy = 0;
    applyTransform();
    setDragDir(null);
    setTimeout(() => onSwiped(dir), 350);
  }, [applyTransform, onSwiped]);

  const onPointerUp = useCallback(() => {
    if (!state.current.dragging || state.current.fired) return;
    state.current.dragging = false;
    const { dx } = state.current;

    if (dx > SWIPE_THRESHOLD) {
      finishSwipe("right");
    } else if (dx < -SWIPE_THRESHOLD) {
      finishSwipe("left");
    } else {
      state.current.dx = 0;
      state.current.dy = 0;
      applyTransform();
      setDragDir(null);
    }
  }, [applyTransform, finishSwipe]);

  // Expose finishSwipe for button clicks
  const btnRef = useRef(finishSwipe);
  btnRef.current = finishSwipe;

  return (
    <div className="relative flex flex-col items-center">
      {/* Card */}
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-[420px] w-[320px] touch-none select-none overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/30"
        style={{ cursor: "grab", willChange: "transform" }}
      >
        {/* ── Image area (60% = 252px) ── */}
        <div className={`relative flex h-[252px] w-full items-center justify-center overflow-hidden bg-gradient-to-br ${gradient}`}>
          {showPhoto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={item.label}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "10px 10px",
                }}
              />
              <span className="relative z-10 text-8xl drop-shadow-lg">{item.emoji}</span>
            </>
          )}

          {/* Like overlay */}
          {dragDir === "right" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#E07856]/30">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-[#E07856] bg-[#1A1614]/40">
                <Check className="h-12 w-12 text-[#E07856]" strokeWidth={2.5} />
              </div>
            </div>
          )}
          {/* Nope overlay */}
          {dragDir === "left" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#9B8E84]/30">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-[#9B8E84] bg-[#1A1614]/40">
                <X className="h-12 w-12 text-[#9B8E84]" strokeWidth={2.5} />
              </div>
            </div>
          )}
        </div>

        {/* ── Info area ── */}
        <div className="flex flex-1 flex-col justify-center px-5 py-4">
          <span className="mb-1.5 inline-flex w-fit rounded-full bg-[#E07856]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#E07856]">
            {subtitle}
          </span>
          <h3 className="text-[22px] font-normal leading-tight text-[#1A1614] font-[family-name:var(--font-instrument-serif)]">
            {item.label}
          </h3>
          {description && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#9B8E84] line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="mt-5 flex items-center gap-6">
        <button
          type="button"
          onClick={() => btnRef.current("left")}
          className="flex h-[56px] w-[56px] cursor-pointer items-center justify-center rounded-full border-2 border-[#9B8E84]/40 bg-[#9B8E84]/10 text-[#9B8E84] transition-all duration-500 ease-out hover:border-[#9B8E84] hover:bg-[#9B8E84]/20 active:scale-90"
        >
          <X className="h-7 w-7" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => btnRef.current("right")}
          className="flex h-[56px] w-[56px] cursor-pointer items-center justify-center rounded-full border-2 border-[#E07856]/40 bg-[#E07856]/10 text-[#E07856] transition-all duration-500 ease-out hover:border-[#E07856] hover:bg-[#E07856]/20 active:scale-90"
        >
          <Check className="h-7 w-7" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════════════════════════════════════════ */

function ProgressHeader({
  round,
  roundIdx,
  cardsDone,
  cardsTotal,
}: {
  round: Round;
  roundIdx: number;
  cardsDone: number;
  cardsTotal: number;
}) {
  const Icon = round.icon;
  const pct = cardsTotal > 0 ? (cardsDone / cardsTotal) * 100 : 0;

  return (
    <div className="mb-5 w-full max-w-[320px]">
      {/* Round dots */}
      <div className="mb-3 flex items-center justify-center gap-2">
        {ROUNDS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
              i < roundIdx
                ? "w-8 bg-[#E07856]"
                : i === roundIdx
                  ? "w-12 bg-[#E07856]"
                  : "w-8 bg-[#F5EDE4]"
            }`}
          />
        ))}
      </div>

      {/* Round label + counter */}
      <div className="flex items-center justify-center gap-2">
        <Icon className="h-5 w-5 text-[#E07856]" strokeWidth={1.5} />
        <span className="text-[15px] font-medium text-[#1A1614]">{round.label}</span>
        <span className="text-[13px] text-[#9B8E84]">
          {cardsDone}/{cardsTotal}
        </span>
      </div>

      {/* Thin progress bar */}
      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-[#F5EDE4]">
        <div
          className="h-full rounded-full bg-[#E07856] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING COUNTER
   ═══════════════════════════════════════════════════════════════════════════ */

function FloatingCounter({ count, emojis }: { count: number; emojis: string[] }) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/30 bg-white/60 backdrop-blur-xl px-4 py-2.5 shadow-[0_2px_16px_rgba(180,140,100,0.10)]">
      <div className="flex -space-x-2">
        {emojis.slice(-3).map((e, i) => (
          <div
            key={i}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8DFD3] bg-[#F5EDE4] text-sm"
            style={{ zIndex: i }}
          >
            {e}
          </div>
        ))}
      </div>
      <span className="text-[13px] font-medium text-[#1A1614]">
        {count} seleccionado{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUMMARY SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   HORIZONTAL SCROLL ROW — avatar/cover style (Spotify)
   ═══════════════════════════════════════════════════════════════════════════ */

function HorizontalRow({
  round,
  ids,
  onRemove,
}: {
  round: Round;
  ids: string[];
  onRemove: (field: string, id: string) => void;
}) {
  const items = ids.map((id) => round.items.find((i) => i.id === id)).filter(Boolean) as UniverseItem[];
  if (items.length === 0) return null;
  const Icon = round.icon;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-[#E07856]" strokeWidth={1.5} />
        <h3 className="text-[15px] font-medium text-[#1A1614]">{round.label}</h3>
        <span className="text-[12px] text-[#9B8E84]">{items.length}</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 pb-2">
        {items.map((item) => {
          const imageUrl = UNIVERSE_IMAGES[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onRemove(round.field, item.id)}
              className="group flex flex-col items-center gap-2 rounded-2xl p-2 transition-all duration-500 ease-out hover:bg-white/30"
            >
              {/* Avatar/Cover */}
              <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#F5EDE4] ring-2 ring-[#E8DFD3]">
                {imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imageUrl} alt={item.label} className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${round.gradient || "from-[#9B8E84] to-[#6B5D54]"}`}>
                    <span className="text-2xl">{item.emoji}</span>
                  </div>
                )}
                {/* Remove overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#1A1614]/60 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <X className="h-5 w-5 text-[#E8DFD3]" strokeWidth={1.5} />
                </div>
              </div>
              <span className="w-full truncate text-center text-[11px] font-medium text-[#6B5D54] group-hover:text-[#1A1614]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SummaryScreen({
  selections,
  onSave,
  saving,
  saved,
  onRestart,
  onRemove,
  onAddCustom,
  onRemoveCustom,
}: {
  selections: Selections;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  onRestart: () => void;
  onRemove: (field: string, id: string) => void;
  onAddCustom: (t: string) => void;
  onRemoveCustom: (t: string) => void;
}) {
  const [input, setInput] = useState("");
  const custom = selections.custom_interests || [];
  const total = ROUNDS.reduce((s, r) => s + (selections[r.field]?.length || 0), 0) + custom.length;

  const addCustom = () => {
    const t = input.trim();
    if (t && !custom.includes(t)) { onAddCustom(t); setInput(""); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-28 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-normal text-[#1A1614] font-[family-name:var(--font-instrument-serif)]">
          Tu Universo
        </h1>
        <p className="mt-1 text-[13px] text-[#6B5D54]">
          {total} elemento{total !== 1 ? "s" : ""} seleccionado{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Horizontal scroll rows by round */}
      {ROUNDS.map((round) => (
        <HorizontalRow
          key={round.id}
          round={round}
          ids={selections[round.field] || []}
          onRemove={onRemove}
        />
      ))}

      {/* Custom interests */}
      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2 px-1">
          <MessageSquare className="h-4 w-4 text-[#E07856]" strokeWidth={1.5} />
          <h3 className="text-[15px] font-medium text-[#1A1614]">Tus sugerencias</h3>
        </div>

        {custom.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {custom.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onRemoveCustom(t)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#E07856]/30 bg-[#E07856]/10 px-3 py-1.5 text-[13px] font-medium text-[#E07856] transition-all duration-500 ease-out hover:border-[#9B8E84]/30 hover:bg-[#9B8E84]/10 hover:text-[#9B8E84]"
              >
                {t}
                <X className="ml-0.5 h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
            placeholder="Ej: Tengo un Plan, Filosofía estoica..."
            maxLength={60}
            className="flex-1 rounded-2xl bg-[#F5EDE4] px-4 py-2.5 text-[13px] text-[#1A1614] placeholder-[#9B8E84] outline-none transition-all duration-500 ease-out focus:bg-white/60 focus:backdrop-blur-xl focus:border focus:border-white/30 focus:ring-2 focus:ring-[#E07856]/30"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!input.trim()}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#E07856] text-white transition-all duration-500 ease-out hover:bg-[#D4A574] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </section>

      {total === 0 && (
        <div className="rounded-3xl bg-white/40 backdrop-blur-xl border border-white/30 p-12 text-center h-[350px] flex flex-col items-center justify-center">
          <Sparkles className="h-[120px] w-[120px] text-[#D4A574] mb-6" strokeWidth={1} />
          <p className="text-[16px] font-medium text-[#6B5D54]">No has seleccionado nada aún.</p>
          <p className="mt-1 text-[13px] text-[#9B8E84]">Explora para personalizar tus podcasts.</p>
          <button
            type="button"
            onClick={onRestart}
            className="mt-6 cursor-pointer rounded-full bg-[#E07856] px-6 py-3 font-medium text-white transition-all duration-500 ease-out hover:bg-[#C96A4A] hover:scale-105"
          >
            Explorar
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-[#E07856] px-6 py-2.5 font-medium text-white transition-all duration-500 ease-out hover:bg-[#C96A4A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.5} />}
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="cursor-pointer rounded-full bg-[#F5EDE4] px-5 py-2.5 text-[13px] font-medium text-[#1A1614] transition-all duration-500 ease-out hover:bg-[#E8DFD3]"
        >
          Explorar más
        </button>
        {saved && (
          <span className="text-[13px] text-[#E07856]">Guardado</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN — UniversoTab
   ═══════════════════════════════════════════════════════════════════════════ */

export function UniversoTab() {
  const [phase, setPhase] = useState<"loading" | "swiping" | "summary">("loading");
  const [roundIdx, setRoundIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [cardKey, setCardKey] = useState(0); // forces remount of SwipeCard

  const [selections, setSelections] = useState<Selections>({
    fav_creators: [], fav_podcasts: [], fav_media: [],
    deep_interests: [], referents: [], platforms: [], custom_interests: [],
  });

  const round = ROUNDS[roundIdx] || ROUNDS[0];
  const items = round.items;
  const currentItem = cardIdx < items.length ? items[cardIdx] : null;

  // ── Load from API ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/universe");
        if (!res.ok) { setPhase("swiping"); return; }
        const data = await res.json();
        if (data.universe) {
          const u = data.universe;
          const s: Selections = {
            fav_creators: u.fav_creators || [], fav_podcasts: u.fav_podcasts || [],
            fav_media: u.fav_media || [], deep_interests: u.deep_interests || [],
            referents: u.referents || [], platforms: u.platforms || [],
            custom_interests: u.custom_interests || [],
          };
          setSelections(s);
          const has = s.fav_creators.length + s.fav_podcasts.length + s.deep_interests.length + s.referents.length > 0;
          setPhase(has ? "summary" : "swiping");
        } else {
          setPhase("swiping");
        }
      } catch { setPhase("swiping"); }
    })();
  }, []);

  // ── Advance round ─────────────────────────────────────
  const nextRound = useCallback(() => {
    if (roundIdx < ROUNDS.length - 1) {
      setRoundIdx((r) => r + 1);
      setCardIdx(0);
      setCardKey((k) => k + 1);
    } else {
      setPhase("summary");
    }
  }, [roundIdx]);

  // ── Swipe handler ─────────────────────────────────────
  const handleSwiped = useCallback((dir: "left" | "right") => {
    if (!currentItem) return;

    if (dir === "right") {
      setSelections((prev) => ({
        ...prev,
        [round.field]: [...(prev[round.field] || []), currentItem.id],
      }));
      setRecentEmojis((prev) => [...prev, currentItem.emoji || ""].slice(-6));
    }

    const nextIdx = cardIdx + 1;
    if (nextIdx >= items.length) {
      setTimeout(nextRound, 150);
    } else {
      setCardIdx(nextIdx);
      setCardKey((k) => k + 1);
    }
  }, [currentItem, round.field, cardIdx, items.length, nextRound]);

  // ── Skip round ────────────────────────────────────────
  const skipRound = useCallback(() => nextRound(), [nextRound]);

  // ── Restart ───────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setRoundIdx(0);
    setCardIdx(0);
    setCardKey((k) => k + 1);
    setSaved(false);
    setPhase("swiping");
  }, []);

  // ── Remove chip ───────────────────────────────────────
  const handleRemove = useCallback((field: string, id: string) => {
    setSelections((prev) => ({ ...prev, [field]: (prev[field] || []).filter((x) => x !== id) }));
    setSaved(false);
  }, []);

  // ── Custom interests ──────────────────────────────────
  const addCustom = useCallback((t: string) => {
    setSelections((prev) => ({
      ...prev,
      custom_interests: [...(prev.custom_interests || []), t].slice(0, 20),
    }));
    setSaved(false);
  }, []);

  const removeCustom = useCallback((t: string) => {
    setSelections((prev) => ({
      ...prev,
      custom_interests: (prev.custom_interests || []).filter((x) => x !== t),
    }));
    setSaved(false);
  }, []);

  // ── Save ──────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/universe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selections),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch { /* silent */ } finally { setSaving(false); }
  }, [selections]);

  // ── Helpers ───────────────────────────────────────────
  const totalSelected = ROUNDS.reduce((s, r) => s + (selections[r.field]?.length || 0), 0)
    + (selections.custom_interests?.length || 0);

  const getGradient = (item: UniverseItem) => {
    if (round.id === "topics" && item.category) return TOPIC_GRADIENTS[item.category] || "from-[#9B8E84] to-[#6B5D54]";
    return round.gradient || "from-[#9B8E84] to-[#6B5D54]";
  };

  const getSubtitle = (item: UniverseItem) => {
    if (round.id === "topics" && item.category) return item.category;
    return round.subtitle;
  };

  /* ═══ RENDER ════════════════════════════════════════════ */

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A574]" />
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <SummaryScreen
        selections={selections}
        onSave={handleSave}
        saving={saving}
        saved={saved}
        onRestart={handleRestart}
        onRemove={handleRemove}
        onAddCustom={addCustom}
        onRemoveCustom={removeCustom}
      />
    );
  }

  /* ── Swiping ───────────────────────────────────────── */
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-start px-4 pt-4 pb-24">
      {/* Title */}
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-normal text-[#1A1614] font-[family-name:var(--font-instrument-serif)]">
          Tu Universo
        </h1>
        <p className="mt-1 text-[13px] text-[#9B8E84]">
          Desliza derecha si te gusta, izquierda si no
        </p>
      </div>

      {/* Progress */}
      <ProgressHeader
        round={round}
        roundIdx={roundIdx}
        cardsDone={cardIdx}
        cardsTotal={items.length}
      />

      {/* Card */}
      {currentItem ? (
        <SwipeCard
          key={cardKey}
          item={currentItem}
          gradient={getGradient(currentItem)}
          subtitle={getSubtitle(currentItem)}
          onSwiped={handleSwiped}
        />
      ) : (
        <div className="flex h-[420px] w-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4A574]" />
        </div>
      )}

      {/* Skip */}
      <button
        type="button"
        onClick={skipRound}
        className="mt-5 flex cursor-pointer items-center justify-center gap-1.5 text-[13px] text-[#9B8E84] transition-all duration-500 ease-out hover:text-[#1A1614]"
      >
        <SkipForward className="h-3.5 w-3.5" />
        Saltar ronda
      </button>

      {/* Floating counter */}
      <FloatingCounter count={totalSelected} emojis={recentEmojis} />
    </div>
  );
}
