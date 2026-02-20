"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth-utils";
import { LogOut, Save, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/types";
import {
  NIVEL_CONOCIMIENTO_LABELS,
  OBJETIVO_PODCAST_LABELS,
  PERIODICIDAD_LABELS,
} from "@/lib/types";

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Campos editables
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [rol, setRol] = useState("");
  const [sector, setSector] = useState("");
  const [edad, setEdad] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [nivelConocimiento, setNivelConocimiento] = useState("");
  const [objetivoPodcast, setObjetivoPodcast] = useState("");
  const [horarioEscucha, setHorarioEscucha] = useState("08:00");
  const [periodicidad, setPeriodicidad] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setNombre(data.profile.nombre || "");
          setEmpresa(data.profile.empresa || "");
          setRol(data.profile.rol || "");
          setSector(data.profile.sector || "");
          setEdad(data.profile.edad || "");
          setCiudad(data.profile.ciudad || "");
          setNivelConocimiento(data.profile.nivel_conocimiento || "");
          setObjetivoPodcast(data.profile.objetivo_podcast || "");
          setHorarioEscucha(data.profile.horario_escucha || "08:00");
          setPeriodicidad(data.profile.periodicidad || "");
        }
      } catch {
        setMessage({ type: "error", text: "Error al cargar el perfil" });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          empresa,
          rol,
          sector,
          edad: edad || null,
          ciudad: ciudad || null,
          nivel_conocimiento: nivelConocimiento || null,
          objetivo_podcast: objetivoPodcast || null,
          horario_escucha: horarioEscucha || null,
          periodicidad: periodicidad || null,
        }),
      });

      if (!res.ok) throw new Error("Error al guardar");

      setMessage({ type: "success", text: "Perfil actualizado" });
    } catch {
      setMessage({ type: "error", text: "Error al guardar el perfil" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  const selectClassName =
    "glass-input w-full";
  const inputClassName =
    "glass-input w-full";

  return (
    <div className="min-h-screen bg-cream px-4 py-12 text-dark">
      <div className="mx-auto max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-3">👤</div>
          <h1 className="text-3xl font-bold">Tu perfil</h1>
          {profile?.email && (
            <p className="mt-2 text-muted">{profile.email}</p>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Datos personales */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Datos personales</h2>
            <div>
              <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-dark/80">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className={inputClassName}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edad" className="mb-1.5 block text-sm font-medium text-dark/80">
                  Edad
                </label>
                <input
                  id="edad"
                  type="text"
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  placeholder="Ej: 25-34"
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="ciudad" className="mb-1.5 block text-sm font-medium text-dark/80">
                  Ciudad
                </label>
                <input
                  id="ciudad"
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="Ej: Madrid"
                  className={inputClassName}
                />
              </div>
            </div>
            <div>
              <label htmlFor="empresa" className="mb-1.5 block text-sm font-medium text-dark/80">
                Empresa
              </label>
              <input
                id="empresa"
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Tu empresa"
                className={inputClassName}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rol" className="mb-1.5 block text-sm font-medium text-dark/80">
                  Rol
                </label>
                <input
                  id="rol"
                  type="text"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  placeholder="Ej: CEO, CTO, Marketing..."
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="sector" className="mb-1.5 block text-sm font-medium text-dark/80">
                  Sector
                </label>
                <input
                  id="sector"
                  type="text"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="Ej: Tech, Finanzas, Salud..."
                  className={inputClassName}
                />
              </div>
            </div>
          </div>

          {/* Preferencias de podcast */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Preferencias de podcast</h2>
            <div>
              <label htmlFor="nivel" className="mb-1.5 block text-sm font-medium text-dark/80">
                Nivel de conocimiento
              </label>
              <select
                id="nivel"
                value={nivelConocimiento}
                onChange={(e) => setNivelConocimiento(e.target.value)}
                className={selectClassName}
              >
                <option value="">Sin especificar</option>
                {Object.entries(NIVEL_CONOCIMIENTO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="objetivo" className="mb-1.5 block text-sm font-medium text-dark/80">
                Objetivo del podcast
              </label>
              <select
                id="objetivo"
                value={objetivoPodcast}
                onChange={(e) => setObjetivoPodcast(e.target.value)}
                className={selectClassName}
              >
                <option value="">Sin especificar</option>
                {Object.entries(OBJETIVO_PODCAST_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="horario" className="mb-1.5 block text-sm font-medium text-dark/80">
                Hora de escucha
              </label>
              <input
                id="horario"
                type="time"
                value={horarioEscucha}
                onChange={(e) => setHorarioEscucha(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="periodicidad" className="mb-1.5 block text-sm font-medium text-dark/80">
                Periodicidad
              </label>
              <select
                id="periodicidad"
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value)}
                className={selectClassName}
              >
                <option value="">Sin especificar</option>
                {Object.entries(PERIODICIDAD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {message && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>

        {/* Logout */}
        <div className="border-t border-white/30 pt-6">
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-200 px-6 py-3 font-medium text-red-600 transition-all duration-300 hover:border-red-300 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  );
}
