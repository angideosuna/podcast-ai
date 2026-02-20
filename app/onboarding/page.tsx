"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, getSubtopicsByCategory } from "@/lib/topics";
import { CategoryCard } from "@/components/category-card";
import { OtrosSection } from "@/components/otros-section";
import { DurationPicker } from "@/components/duration-picker";
import { TonePicker } from "@/components/tone-picker";
import { VoicePicker } from "@/components/voice-picker";
import { OptionPicker } from "@/components/option-picker";

const NIVEL_OPTIONS = [
  { value: "principiante", label: "Principiante", emoji: "🌱", descripcion: "Estoy empezando en estos temas" },
  { value: "intermedio", label: "Intermedio", emoji: "📚", descripcion: "Tengo conocimientos básicos" },
  { value: "experto", label: "Experto", emoji: "🎓", descripcion: "Domino los temas en profundidad" },
];

const OBJETIVO_OPTIONS = [
  { value: "informarme", label: "Informarme", emoji: "📰", descripcion: "Estar al día con lo esencial" },
  { value: "aprender", label: "Aprender", emoji: "🧠", descripcion: "Profundizar y entender en detalle" },
  { value: "entretenerme", label: "Entretenerme", emoji: "🎧", descripcion: "Pasarlo bien mientras escucho" },
];

const HORARIO_OPTIONS = [
  { value: "manana", label: "Mañana", emoji: "🌅" },
  { value: "mediodia", label: "Mediodía", emoji: "☀️" },
  { value: "tarde", label: "Tarde", emoji: "🌇" },
  { value: "noche", label: "Noche", emoji: "🌙" },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Number(searchParams.get("step")) || 1;

  const [step, setStep] = useState(initialStep);

  // Step 1 — Encuesta personal
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [rol, setRol] = useState("");
  const [sector, setSector] = useState("");
  const [nivelConocimiento, setNivelConocimiento] = useState<string | null>(null);
  const [objetivoPodcast, setObjetivoPodcast] = useState<string | null>(null);
  const [horarioEscucha, setHorarioEscucha] = useState<string | null>(null);
  const [surveyLoaded, setSurveyLoaded] = useState(false);

  // Step 2 — Temas (nuevo: categorías con subtemas)
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Step 3 — Configuración
  const [duration, setDuration] = useState<number | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);

  // Cargar perfil existente para pre-popular
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) {
          const p = data.profile;
          if (p.nombre) setNombre(p.nombre);
          if (p.edad) setEdad(p.edad);
          if (p.ciudad) setCiudad(p.ciudad);
          if (p.rol) setRol(p.rol);
          if (p.sector) setSector(p.sector);
          if (p.nivel_conocimiento) setNivelConocimiento(p.nivel_conocimiento);
          if (p.objetivo_podcast) setObjetivoPodcast(p.objetivo_podcast);
          if (p.horario_escucha) setHorarioEscucha(p.horario_escucha);
        }
      } catch {
        // Silencioso — el usuario puede no estar autenticado
      } finally {
        setSurveyLoaded(true);
      }
    }
    loadProfile();
  }, []);

  // --- Handlers Step 2 ---

  const toggleSubtopic = (subtopicId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(subtopicId)
        ? prev.filter((id) => id !== subtopicId)
        : [...prev, subtopicId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    const catSubtopicIds = getSubtopicsByCategory(categoryId);
    const allSelected = catSubtopicIds.every((id) => selectedSubtopics.includes(id));

    if (allSelected) {
      // Deseleccionar todos
      setSelectedSubtopics((prev) => prev.filter((id) => !catSubtopicIds.includes(id)));
    } else {
      // Seleccionar todos los que faltan
      setSelectedSubtopics((prev) => [
        ...prev,
        ...catSubtopicIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const addCustomTopic = (label: string) => {
    setCustomTopics((prev) => [...prev, label]);
  };

  const removeCustomTopic = (label: string) => {
    setCustomTopics((prev) => prev.filter((t) => t !== label));
  };

  const totalSelected = selectedSubtopics.length + customTopics.length;

  // Validaciones
  const canGoToStep2 =
    nombre.trim() !== "" &&
    nivelConocimiento !== null &&
    objetivoPodcast !== null &&
    horarioEscucha !== null;
  const canGoToStep3 = totalSelected >= 1;
  const canFinish = duration !== null && tone !== null && voice !== null;

  // Guardar encuesta y avanzar a Step 2
  const handleSaveSurvey = async () => {
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          edad: edad || null,
          ciudad: ciudad || null,
          rol: rol || null,
          sector: sector || null,
          nivel_conocimiento: nivelConocimiento,
          objetivo_podcast: objetivoPodcast,
          horario_escucha: horarioEscucha,
          survey_completed: true,
        }),
      });
    } catch {
      // Silencioso — continúa al siguiente paso
    }
    setStep(2);
  };

  // Guardar preferencias y finalizar
  const handleFinish = async () => {
    const allTopics = [
      ...selectedSubtopics,
      ...customTopics.map((t) => `custom:${t}`),
    ];

    const preferences = {
      topics: allTopics,
      duration,
      tone,
      voice,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("podcast-ai-preferences", JSON.stringify(preferences));

    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: allTopics, duration, tone, voice }),
      });
    } catch {
      // Silencioso: localStorage sirve como fallback
    }

    router.push("/onboarding/confirmacion");
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      {/* Barra de progreso */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">
              <span className="text-stone-900">PodCast</span>
              <span className="text-stone-400">.ai</span>
            </h1>
            <span className="text-sm text-stone-500">Paso {step} de 3</span>
          </div>
          {/* Barra visual */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900 transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        {/* ========== PASO 1: Encuesta personal ========== */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Cuéntanos sobre ti</h2>
              <p className="mt-2 text-stone-500">
                Personaliza tu experiencia para que cada podcast sea único
              </p>
            </div>

            {/* Formulario de datos personales */}
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
              <div>
                <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-stone-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
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
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
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
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
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
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
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
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>
            </div>

            {/* Pickers */}
            <OptionPicker
              title="Nivel de conocimiento *"
              options={NIVEL_OPTIONS}
              selected={nivelConocimiento}
              onSelect={setNivelConocimiento}
              columns={3}
            />

            <OptionPicker
              title="Objetivo del podcast *"
              options={OBJETIVO_OPTIONS}
              selected={objetivoPodcast}
              onSelect={setObjetivoPodcast}
              columns={3}
            />

            <OptionPicker
              title="Horario de escucha *"
              options={HORARIO_OPTIONS}
              selected={horarioEscucha}
              onSelect={setHorarioEscucha}
              columns={4}
            />

            {/* Botón siguiente */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleSaveSurvey}
                disabled={!canGoToStep2}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-200
                  ${
                    canGoToStep2
                      ? "bg-stone-900 text-white hover:opacity-90 shadow-md shadow-stone-300/50 cursor-pointer"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }
                `}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ========== PASO 2: Elegir temas ========== */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Elige tus temas de interés</h2>
              <p className="mt-2 text-stone-500">
                Selecciona los subtemas que te interesen de cada categoría
              </p>
            </div>

            {/* Contador de selección */}
            <div className="flex justify-center">
              <span
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  totalSelected >= 1
                    ? "bg-stone-800/8 text-stone-900"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {totalSelected} {totalSelected === 1 ? "tema seleccionado" : "temas seleccionados"}
              </span>
            </div>

            {/* Lista de categorías */}
            <div className="space-y-3">
              {CATEGORIES.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  expanded={expandedCategories.includes(category.id)}
                  selectedSubtopics={selectedSubtopics}
                  onToggleExpand={() => toggleExpanded(category.id)}
                  onToggleCategory={() => toggleCategory(category.id)}
                  onToggleSubtopic={toggleSubtopic}
                />
              ))}
            </div>

            {/* Sección Otros */}
            <OtrosSection
              customTopics={customTopics}
              onAdd={addCustomTopic}
              onRemove={removeCustomTopic}
            />

            {/* Botones de navegación */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setStep(1)}
                className="rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 cursor-pointer"
              >
                ← Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canGoToStep3}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-200
                  ${
                    canGoToStep3
                      ? "bg-stone-900 text-white hover:opacity-90 shadow-md shadow-stone-300/50 cursor-pointer"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }
                `}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ========== PASO 3: Duración y tono ========== */}
        {step === 3 && (
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-bold">Configura tu podcast</h2>
              <p className="mt-2 text-stone-500">
                Elige la duración y el estilo que prefieras
              </p>
            </div>

            <DurationPicker selected={duration} onSelect={setDuration} />
            <TonePicker selected={tone} onSelect={setTone} />
            <VoicePicker selected={voice} onSelect={setVoice} />

            {/* Botones de navegación */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setStep(2)}
                className="rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 cursor-pointer"
              >
                ← Atrás
              </button>
              <button
                onClick={handleFinish}
                disabled={!canFinish}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-200
                  ${
                    canFinish
                      ? "bg-stone-900 text-white hover:opacity-90 shadow-md shadow-stone-300/50 cursor-pointer"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }
                `}
              >
                Generar mi primer podcast 🎙️
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-100">
          <div className="text-stone-500">Cargando...</div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
