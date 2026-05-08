"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logout } from "@/lib/auth-utils";
import { CATEGORIES, getSubtopicsByCategory } from "@/lib/topics";
import { CategoryCard } from "@/components/category-card";
import { OtrosSection } from "@/components/otros-section";
import { OptionPicker } from "@/components/option-picker";
import { DurationPicker } from "@/components/duration-picker";
import { TonePicker } from "@/components/tone-picker";
import { VoicePicker } from "@/components/voice-picker";
import { FollowersModal } from "@/components/social/followers-modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  Save,
  LogOut,
  ChevronDown,
  ChevronUp,
  Globe,
  Lock,
  Users,
  Settings,
  Mic,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────

const EDAD_OPTIONS = ["18-24", "25-34", "35-44", "45-54", "55+"];

const SECTOR_OPTIONS = ["Tech", "Finanzas", "Salud", "Educación", "Marketing", "Legal", "Otro"];

const OBJETIVO_OPTIONS = [
  { value: "informarme", label: "Informarme", emoji: "📰", descripcion: "Estar al día con lo esencial" },
  { value: "aprender", label: "Aprender", emoji: "🧠", descripcion: "Profundizar y entender en detalle" },
  { value: "entretenerme", label: "Entretenerme", emoji: "🎧", descripcion: "Pasarlo bien mientras escucho" },
];

const PERIODICIDAD_OPTIONS = [
  { value: "todos-los-dias", label: "Todos los días", apiValue: "daily" },
  { value: "lunes-a-viernes", label: "Lunes a Viernes", apiValue: "weekdays" },
  { value: "personalizado", label: "Personalizado", apiValue: "custom" },
];

const DIAS_SEMANA = [
  { value: "L", label: "L", api: 1 },
  { value: "M", label: "M", api: 2 },
  { value: "X", label: "X", api: 3 },
  { value: "J", label: "J", api: 4 },
  { value: "V", label: "V", api: 5 },
  { value: "S", label: "S", api: 6 },
  { value: "D", label: "D", api: 0 },
];

// ─── Props ──────────────────────────────────────────────────

interface PerfilTabProps {
  onNameChange: (name: string) => void;
  onSurveyChange: (completed: boolean) => void;
}

// ─── Helpers ────────────────────────────────────────────────

function periodicidadToUI(apiFreq: string): string {
  const match = PERIODICIDAD_OPTIONS.find((o) => o.apiValue === apiFreq);
  return match?.value ?? "todos-los-dias";
}

function periodicidadToAPI(uiValue: string): string {
  const match = PERIODICIDAD_OPTIONS.find((o) => o.value === uiValue);
  return match?.apiValue ?? "daily";
}

function apiDaysToUI(apiDays: number[]): string[] {
  return DIAS_SEMANA.filter((d) => apiDays.includes(d.api)).map((d) => d.value);
}

function uiDaysToAPI(uiDays: string[]): number[] {
  return DIAS_SEMANA.filter((d) => uiDays.includes(d.value)).map((d) => d.api);
}

// ═══════════════════════════════════════════════════════════════
// PERFIL TAB
// ═══════════════════════════════════════════════════════════════

export function PerfilTab({ onNameChange, onSurveyChange }: PerfilTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // ─── Profile header state (read-only display) ─────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");

  // ─── Section A state (profile form) ───────────────────────
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [rol, setRol] = useState("");
  const [sector, setSector] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ─── Section B state (preferences + schedule) ─────────────
  const [objetivoPodcast, setObjetivoPodcast] = useState<string | null>(null);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [periodicidad, setPeriodicidad] = useState<string | null>(null);
  const [diasPersonalizados, setDiasPersonalizados] = useState<string[]>([]);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ─── Collapsible sections ───────────────────────────────────
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["perfil"]));

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // ─── Load initial data ─────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [profileRes, prefsRes, scheduleRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/preferences"),
          fetch("/api/schedule"),
        ]);

        if (profileRes.status === 401) { router.push("/login"); return; }

        const profileData = await profileRes.json();
        if (profileData.profile) {
          const p = profileData.profile;
          setEmail(p.email || "");
          setNombre(p.nombre || "");
          setEdad(p.edad || "");
          setCiudad(p.ciudad || "");
          setRol(p.rol || "");
          setSector(p.sector || "");
          setObjetivoPodcast(p.objetivo_podcast || null);
          setAvatarUrl(p.avatar_url || null);
          setUsername(p.username || "");
          setBio(p.bio || "");
          setIsPublic(!!p.is_public);
          setFollowersCount(p.followers_count || 0);
          setFollowingCount(p.following_count || 0);
        }

        if (prefsRes.ok) {
          const prefsData = await prefsRes.json();
          if (prefsData.preferences) {
            const pr = prefsData.preferences;
            if (pr.topics?.length) {
              setSelectedSubtopics(pr.topics.filter((t: string) => !t.startsWith("custom:")));
              setCustomTopics(pr.topics.filter((t: string) => t.startsWith("custom:")).map((t: string) => t.replace("custom:", "")));
            }
            if (pr.duration) setDuration(pr.duration);
            if (pr.tone) setTone(pr.tone);
            setVoice(pr.voice || "female");
          }
        }

        if (scheduleRes.ok) {
          const scheduleData = await scheduleRes.json();
          if (scheduleData.schedule) {
            const s = scheduleData.schedule;
            if (s.time) setScheduleTime(s.time.slice(0, 5));
            if (s.frequency) setPeriodicidad(periodicidadToUI(s.frequency));
            if (s.custom_days?.length) setDiasPersonalizados(apiDaysToUI(s.custom_days));
            setScheduleActive(!!s.is_active);
          }
        }
      } catch {
        // silent — sections show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // ─── Profile completion ────────────────────────────────────
  const calcCompletion = useCallback(() => {
    let filled = 0;
    if (nombre) filled++;
    if (edad) filled++;
    if (ciudad) filled++;
    if (rol) filled++;
    if (sector) filled++;
    if (objetivoPodcast) filled++;
    if (periodicidad) filled++;
    if (selectedSubtopics.length > 0 || customTopics.length > 0) filled++;
    if (duration) filled++;
    if (tone) filled++;
    return Math.round((filled / 10) * 100);
  }, [nombre, edad, ciudad, rol, sector, objetivoPodcast, periodicidad, selectedSubtopics, customTopics, duration, tone]);

  const completion = calcCompletion();

  // ─── Save profile ──────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          edad: edad || null,
          ciudad: ciudad || null,
          rol: rol || null,
          sector: sector || null,
          objetivo_podcast: objetivoPodcast,
          survey_completed: !!objetivoPodcast,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar el perfil");
      }
      setProfileMsg({ type: "success", text: "Perfil actualizado" });
      onNameChange(nombre);
      onSurveyChange(!!objetivoPodcast);
    } catch (e) {
      setProfileMsg({ type: "error", text: e instanceof Error ? e.message : "Error al guardar el perfil" });
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Save preferences + schedule ───────────────────────────
  const handleSavePrefs = async () => {
    const topics = [
      ...selectedSubtopics,
      ...customTopics.map((t) => "custom:" + t),
    ];

    const missing: string[] = [];
    if (!topics.length) missing.push("temas");
    if (!duration) missing.push("duración");
    if (!tone) missing.push("tono");
    if (missing.length) {
      setPrefsMsg({ type: "error", text: `Completa antes: ${missing.join(", ")}` });
      return;
    }

    setSavingPrefs(true);
    setPrefsMsg(null);
    try {
      const [prefsRes, scheduleRes] = await Promise.all([
        fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics, duration, tone, voice }),
        }),
        fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            time: scheduleTime,
            frequency: periodicidad ? periodicidadToAPI(periodicidad) : "daily",
            custom_days: periodicidad === "personalizado" ? uiDaysToAPI(diasPersonalizados) : [],
            is_active: scheduleActive,
          }),
        }),
      ]);
      if (!prefsRes.ok) {
        const err = await prefsRes.json().catch(() => ({}));
        throw new Error(err.error || `Preferencias: ${prefsRes.status}`);
      }
      if (!scheduleRes.ok) {
        const err = await scheduleRes.json().catch(() => ({}));
        throw new Error(err.error || `Horario: ${scheduleRes.status}`);
      }
      setPrefsMsg({ type: "success", text: "Preferencias actualizadas" });
    } catch (e) {
      setPrefsMsg({ type: "error", text: e instanceof Error && e.message ? e.message : "Error al guardar preferencias" });
    } finally {
      setSavingPrefs(false);
    }
  };

  // ─── Topic toggles ────────────────────────────────────────
  const handleToggleCategory = useCallback((categoryId: string) => {
    const subs = getSubtopicsByCategory(categoryId);
    setSelectedSubtopics((prev) => {
      const allSelected = subs.every((s) => prev.includes(s));
      if (allSelected) return prev.filter((s) => !subs.includes(s));
      return [...new Set([...prev, ...subs])];
    });
  }, []);

  const handleToggleSubtopic = useCallback((subtopicId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(subtopicId) ? prev.filter((s) => s !== subtopicId) : [...prev, subtopicId]
    );
  }, []);

  const handleToggleExpanded = useCallback((categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId]
    );
  }, []);

  // ─── Day toggle ────────────────────────────────────────────
  const toggleDia = useCallback((dia: string) => {
    setDiasPersonalizados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  }, []);

  // ─── Logout ────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  // ─── Avatar initials ──────────────────────────────────────
  const initials = nombre
    ? nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // ─── Shared styles ─────────────────────────────────────────
  const inputCls = "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-colors focus:border-[#7C3AED]/50";

  const sectionHeaderCls = (section: string) =>
    `flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left font-semibold transition-colors duration-200 hover:bg-[#F9FAFB] ${
      openSections.has(section) ? "text-[#111827]" : "text-[#6B7280]"
    }`;

  const msgCls = (type: "success" | "error") =>
    `rounded-2xl border px-4 py-3 text-[13px] ${
      type === "success"
        ? "border-[#7C3AED]/20 bg-[#7C3AED]/10 text-[#7C3AED]"
        : "border-red-500/20 bg-red-500/10 text-red-400"
    }`;

  const saveBtnCls = "flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#7C3AED] px-6 py-2.5 font-semibold text-white transition-colors hover:bg-[#A855F7] disabled:cursor-not-allowed disabled:opacity-50";

  const labelCls = "mb-1.5 block text-[13px] font-medium text-[#6B7280]";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-8 lg:px-8">
      {/* ═══ Profile Hero Header (estilo Spotify) ═══ */}
      <div className="relative mb-8">
        {/* Gradient background */}
        <div className="h-[180px] bg-gradient-to-b from-[#7C3AED]/15 via-[#7C3AED]/5 to-[#F9FAFB]" />

        {/* Profile info overlay */}
        <div className="relative -mt-16 px-6">
          <div className="flex items-end gap-5">
            {/* Avatar grande */}
            <Avatar className="h-28 w-28 ring-4 ring-white">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={nombre} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-2xl font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Name + username + badge */}
            <div className="mb-2 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <span className="rounded-full bg-[#7C3AED]/15 px-2 py-0.5 text-[11px] font-medium text-[#7C3AED]">
                    <Globe className="mr-1 inline h-3 w-3" />Público
                  </span>
                ) : (
                  <span className="rounded-full bg-white border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]">
                    <Lock className="mr-1 inline h-3 w-3" />Privado
                  </span>
                )}
              </div>
              <h1 className="mt-1 truncate text-3xl font-bold text-[#111827] font-[family-name:var(--font-montserrat)]">
                {nombre || "Tu perfil"}
              </h1>
              {username && (
                <p className="text-[15px] text-[#6B7280]">@{username}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          {bio && (
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[#6B7280]">
              {bio}
            </p>
          )}

          {/* Stats + actions row */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* Stats */}
            <button
              type="button"
              onClick={() => { setFollowersModalTab("followers"); setShowFollowersModal(true); }}
              className="text-[14px] text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              <span className="font-semibold text-[#111827]">{followersCount}</span> seguidores
            </button>
            <button
              type="button"
              onClick={() => { setFollowersModalTab("following"); setShowFollowersModal(true); }}
              className="text-[14px] text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              <span className="font-semibold text-[#111827]">{followingCount}</span> siguiendo
            </button>

            <div className="flex-1" />

            {/* View profile button */}
            {isPublic && username && (
              <Link
                href={`/u/${username}`}
                className="flex items-center gap-1.5 rounded-full border border-[#7C3AED] px-4 py-1.5 text-[13px] font-semibold text-[#7C3AED] transition-all duration-200 hover:bg-[#7C3AED]/10"
              >
                <Users className="h-3.5 w-3.5" />
                Ver mi perfil
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {completion < 100 && (
        <div className="mx-4 mb-6 rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <p className="mb-2 text-[13px] font-medium text-[#6B7280]">
            Completa tu perfil para podcasts más personalizados ({completion}%)
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="h-full rounded-full bg-[#7C3AED] transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-4 px-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        {/* ═══ Section A — Datos personales ═══ */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <button
            type="button"
            onClick={() => toggleSection("perfil")}
            className={sectionHeaderCls("perfil")}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-[#6B7280]" />
              Datos personales
            </span>
            {openSections.has("perfil") ? (
              <ChevronUp className="h-4 w-4 text-[#9CA3AF]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
            )}
          </button>

          {openSections.has("perfil") && (
            <div className="space-y-5 px-4 pb-5">
              {/* Nombre */}
              <div>
                <label htmlFor="p-nombre" className={labelCls}>Nombre</label>
                <input id="p-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className={inputCls} />
              </div>

              {/* Edad + Ciudad */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-edad" className={labelCls}>Edad</label>
                  <select id="p-edad" value={edad} onChange={(e) => setEdad(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar</option>
                    {EDAD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="p-ciudad" className={labelCls}>Ciudad</label>
                  <input id="p-ciudad" type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej: Madrid" className={inputCls} />
                </div>
              </div>

              {/* Rol + Sector */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-rol" className={labelCls}>Rol profesional</label>
                  <input id="p-rol" type="text" value={rol} onChange={(e) => setRol(e.target.value)} placeholder="Ej: CEO, CTO..." className={inputCls} />
                </div>
                <div>
                  <label htmlFor="p-sector" className={labelCls}>Sector</label>
                  <select id="p-sector" value={sector} onChange={(e) => setSector(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar</option>
                    {SECTOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {profileMsg && <div className={msgCls(profileMsg.type)}>{profileMsg.text}</div>}

              <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className={saveBtnCls}>
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingProfile ? "Guardando..." : "Guardar perfil"}
              </button>
            </div>
          )}
        </div>

        {/* ═══ Section B — Preferencias de podcast ═══ */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <button
            type="button"
            onClick={() => toggleSection("preferencias")}
            className={sectionHeaderCls("preferencias")}
          >
            <span className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-[#6B7280]" />
              Preferencias de podcast
            </span>
            {openSections.has("preferencias") ? (
              <ChevronUp className="h-4 w-4 text-[#9CA3AF]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
            )}
          </button>

          {openSections.has("preferencias") && (
            <div className="space-y-5 px-4 pb-5">
              {/* Objetivo del podcast */}
              <OptionPicker
                title="Objetivo del podcast"
                options={OBJETIVO_OPTIONS}
                selected={objetivoPodcast}
                onSelect={setObjetivoPodcast}
                columns={3}
              />

              {/* Temas */}
              <div>
                <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Temas</h3>
                <div className="space-y-3">
                  {CATEGORIES.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      expanded={expandedCategories.includes(cat.id)}
                      selectedSubtopics={selectedSubtopics}
                      onToggleExpand={() => handleToggleExpanded(cat.id)}
                      onToggleCategory={() => handleToggleCategory(cat.id)}
                      onToggleSubtopic={handleToggleSubtopic}
                    />
                  ))}
                </div>
                <div className="mt-4">
                  <OtrosSection
                    customTopics={customTopics}
                    onAdd={(label) => setCustomTopics((prev) => [...prev, label])}
                    onRemove={(label) => setCustomTopics((prev) => prev.filter((t) => t !== label))}
                  />
                </div>
              </div>

              {/* Duration */}
              <DurationPicker selected={duration} onSelect={setDuration} />

              {/* Tone */}
              <TonePicker selected={tone} onSelect={setTone} />

              {/* Voice */}
              <VoicePicker selected={voice} onSelect={setVoice} />

              {/* ── Generación automática ── */}
              <div className="border-t border-[#E5E7EB] pt-5">
                <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Generación automática</h3>

                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[#6B7280]">Activar generación automática</span>
                  <button
                    type="button"
                    onClick={() => setScheduleActive((v) => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ${
                      scheduleActive ? "bg-[#7C3AED]" : "bg-[#E5E7EB]"
                    }`}
                    role="switch"
                    aria-checked={scheduleActive}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-300 ${
                        scheduleActive ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Hora */}
                <div className="mt-4">
                  <label htmlFor="p-hora" className={labelCls}>Hora de generación</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="p-hora"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className={inputCls + " w-auto"}
                    />
                    <span className="text-[13px] text-[#9CA3AF]">Tu podcast estará listo a esta hora</span>
                  </div>
                </div>

                {/* Periodicidad */}
                <div className="mt-4">
                  <p className="mb-2 text-[13px] font-medium text-[#6B7280]">Periodicidad</p>
                  <div className="flex flex-wrap gap-2">
                    {PERIODICIDAD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPeriodicidad(opt.value)}
                        className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                          periodicidad === opt.value
                            ? "bg-[#7C3AED] text-white"
                            : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#111827]"
                        }`}
                      >
                        {periodicidad === opt.value && (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Días personalizados */}
                {periodicidad === "personalizado" && (
                  <div className="mt-4">
                    <p className="mb-2 text-[13px] font-medium text-[#6B7280]">Selecciona los días:</p>
                    <div className="flex gap-2">
                      {DIAS_SEMANA.map((dia) => (
                        <button
                          key={dia.value}
                          type="button"
                          onClick={() => toggleDia(dia.value)}
                          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-200 ${
                            diasPersonalizados.includes(dia.value)
                              ? "bg-[#7C3AED] text-white"
                              : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#111827]"
                          }`}
                        >
                          {dia.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {prefsMsg && <div className={msgCls(prefsMsg.type)}>{prefsMsg.text}</div>}

              <button type="button" onClick={handleSavePrefs} disabled={savingPrefs} className={saveBtnCls}>
                {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingPrefs ? "Guardando..." : "Guardar preferencias"}
              </button>
            </div>
          )}
        </div>

        {/* ═══ Section C — Cuenta ═══ */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-[#6B7280]" />
            <h3 className="font-semibold text-[#111827]">Cuenta</h3>
          </div>
          {email && (
            <p className="mb-4 text-[13px] text-[#9CA3AF]">{email}</p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex cursor-pointer items-center gap-2 text-[13px] text-[#9CA3AF] transition-all duration-200 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* ═══ Followers Modal ═══ */}
      <FollowersModal
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        initialTab={followersModalTab}
        followersCount={followersCount}
        followingCount={followingCount}
      />
    </div>
  );
}
