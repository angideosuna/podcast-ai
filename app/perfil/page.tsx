"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth-utils";
import { LogOut, Save, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/types";
import {
  NIVEL_CONOCIMIENTO_LABELS,
  OBJETIVO_PODCAST_LABELS,
  HORARIO_ESCUCHA_LABELS,
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
  const [horarioEscucha, setHorarioEscucha] = useState("");

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
          setHorarioEscucha(data.profile.horario_escucha || "");
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
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    );
  }

  const selectClassName =
    "w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400";
  const inputClassName =
    "w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400";

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-12 text-stone-900">
      <div className="mx-auto max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-3">👤</div>
          <h1 className="text-3xl font-bold">Tu perfil</h1>
          {profile?.email && (
            <p className="mt-2 text-stone-500">{profile.email}</p>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Datos personales */}
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Datos personales</h2>
            <div>
              <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-stone-700">
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
                <label htmlFor="edad" className="mb-1.5 block text-sm font-medium text-stone-700">
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
                <label htmlFor="ciudad" className="mb-1.5 block text-sm font-medium text-stone-700">
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
              <label htmlFor="empresa" className="mb-1.5 block text-sm font-medium text-stone-700">
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
                <label htmlFor="rol" className="mb-1.5 block text-sm font-medium text-stone-700">
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
                <label htmlFor="sector" className="mb-1.5 block text-sm font-medium text-stone-700">
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
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Preferencias de podcast</h2>
            <div>
              <label htmlFor="nivel" className="mb-1.5 block text-sm font-medium text-stone-700">
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
              <label htmlFor="objetivo" className="mb-1.5 block text-sm font-medium text-stone-700">
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
              <label htmlFor="horario" className="mb-1.5 block text-sm font-medium text-stone-700">
                Horario de escucha
              </label>
              <select
                id="horario"
                value={horarioEscucha}
                onChange={(e) => setHorarioEscucha(e.target.value)}
                className={selectClassName}
              >
                <option value="">Sin especificar</option>
                {Object.entries(HORARIO_ESCUCHA_LABELS).map(([value, label]) => (
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
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="border-t border-stone-200 pt-6">
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-200 px-6 py-3 font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  );
}
