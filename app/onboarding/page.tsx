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

const TOTAL_STEPS = 4;

const OBJETIVO_OPTIONS = [
  { value: "informarme", label: "Informarme", emoji: "📰", descripcion: "Estar al día con lo esencial" },
  { value: "aprender", label: "Aprender", emoji: "🧠", descripcion: "Profundizar y entender en detalle" },
  { value: "entretenerme", label: "Entretenerme", emoji: "🎧", descripcion: "Pasarlo bien mientras escucho" },
];

const PERIODICIDAD_OPTIONS = [
  { value: "todos-los-dias", label: "Todos los días", desc: "Lunes a Domingo" },
  { value: "lunes-a-viernes", label: "Lunes a Viernes", desc: "Días laborables" },
  { value: "personalizado", label: "Personalizado", desc: "Elige los días" },
];

const DIAS_SEMANA = [
  { value: "L", label: "L" },
  { value: "M", label: "M" },
  { value: "X", label: "X" },
  { value: "J", label: "J" },
  { value: "V", label: "V" },
  { value: "S", label: "S" },
  { value: "D", label: "D" },
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
  const [objetivoPodcast, setObjetivoPodcast] = useState<string | null>(null);
  const [surveyLoaded, setSurveyLoaded] = useState(false);

  // Step 2 — Horario de escucha
  const [horaEscucha, setHoraEscucha] = useState("08:00");
  const [periodicidad, setPeriodicidad] = useState<string | null>(null);
  const [diasPersonalizados, setDiasPersonalizados] = useState<string[]>([]);

  // Step 3 — Temas (categorías con subtemas)
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [suggestingTopics, setSuggestingTopics] = useState(false);
  const [suggestionsApplied, setSuggestionsApplied] = useState(false);

  // Step 4 — Configuración
  const [duration, setDuration] = useState<number | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [recommendedTone, setRecommendedTone] = useState<string | null>(null);

  // Cargar perfil y schedule existentes para pre-popular
  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, scheduleRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/schedule"),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile) {
            const p = data.profile;
            if (p.nombre) setNombre(p.nombre);
            if (p.edad) setEdad(p.edad);
            if (p.ciudad) setCiudad(p.ciudad);
            if (p.rol) setRol(p.rol);
            if (p.sector) setSector(p.sector);
            if (p.objetivo_podcast) setObjetivoPodcast(p.objetivo_podcast);
          }
        }

        if (scheduleRes.ok) {
          const data = await scheduleRes.json();
          if (data.schedule) {
            const s = data.schedule;
            if (s.time) setHoraEscucha(s.time.slice(0, 5)); // "08:00:00" → "08:00"
            if (s.frequency === "daily") setPeriodicidad("todos-los-dias");
            else if (s.frequency === "weekdays") setPeriodicidad("lunes-a-viernes");
            else if (s.frequency === "custom") {
              setPeriodicidad("personalizado");
              // Map DB day numbers (0=Sun) to our labels
              const dayMap: Record<number, string> = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };
              if (s.custom_days) setDiasPersonalizados(s.custom_days.map((d: number) => dayMap[d] || ""));
            }
          }
        }
      } catch {
        // Silencioso — el usuario puede no estar autenticado
      } finally {
        setSurveyLoaded(true);
      }
    }
    loadData();
  }, []);

  // --- Handlers Step 2 (Horario) ---

  const selectPeriodicidad = (value: string) => {
    setPeriodicidad(value);
    if (value !== "personalizado") {
      setDiasPersonalizados([]);
    }
  };

  const toggleDia = (dia: string) => {
    setDiasPersonalizados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const canConfirmSchedule =
    horaEscucha !== "" &&
    periodicidad !== null &&
    (periodicidad !== "personalizado" || diasPersonalizados.length >= 1);

  const handleConfirmSchedule = async () => {
    // Map UI periodicidad to DB frequency
    const frequencyMap: Record<string, string> = {
      "todos-los-dias": "daily",
      "lunes-a-viernes": "weekdays",
      "personalizado": "custom",
    };
    const frequency = periodicidad ? frequencyMap[periodicidad] || "weekdays" : "weekdays";

    // Map UI day labels to DB day numbers (0=Sunday)
    const dayLabelToNumber: Record<string, number> = { D: 0, L: 1, M: 2, X: 3, J: 4, V: 5, S: 6 };
    const customDays = periodicidad === "personalizado"
      ? diasPersonalizados.map((d) => dayLabelToNumber[d] ?? 0)
      : [];

    try {
      await Promise.all([
        fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            horario_escucha: horaEscucha,
            periodicidad,
            dias_personalizados: periodicidad === "personalizado" ? diasPersonalizados : null,
          }),
        }),
        fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            time: horaEscucha,
            frequency,
            custom_days: customDays,
            is_active: true,
          }),
        }),
      ]);
    } catch {
      // Silencioso
    }
    setStep(3);
  };

  const handleSkipSchedule = () => {
    setStep(3);
  };

  // --- AI Topic Suggestion ---

  const handleSuggestTopics = async () => {
    setSuggestingTopics(true);
    try {
      const res = await fetch("/api/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          rol: rol || undefined,
          sector: sector || undefined,
          objetivo: objetivoPodcast || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const categories: string[] = data.categories || [];

        if (categories.length > 0) {
          setSuggestedCategories(categories);

          // Pre-select all subtopics of suggested categories
          const newSubtopics: string[] = [];
          for (const catId of categories) {
            const catSubs = getSubtopicsByCategory(catId);
            for (const subId of catSubs) {
              if (!selectedSubtopics.includes(subId) && !newSubtopics.includes(subId)) {
                newSubtopics.push(subId);
              }
            }
          }
          setSelectedSubtopics((prev) => [...prev, ...newSubtopics]);

          // Expand suggested categories
          setExpandedCategories((prev) => [
            ...prev,
            ...categories.filter((id) => !prev.includes(id)),
          ]);

          setSuggestionsApplied(true);
        }
      }
    } catch {
      // Silencioso — el usuario selecciona manualmente
    } finally {
      setSuggestingTopics(false);
    }
  };

  // --- Handlers Step 3 (Temas) ---

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
      setSelectedSubtopics((prev) => prev.filter((id) => !catSubtopicIds.includes(id)));
    } else {
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
    objetivoPodcast !== null;
  const canGoToStep4 = totalSelected >= 1;

  const goToStep4 = () => {
    // Auto-suggest tone based on profile
    if (!tone) {
      if (objetivoPodcast === "entretenerme") {
        setTone("casual");
        setRecommendedTone("casual");
      } else if (objetivoPodcast === "informarme") {
        setTone("profesional");
        setRecommendedTone("profesional");
      } else if (objetivoPodcast === "aprender") {
        setTone("deep-dive");
        setRecommendedTone("deep-dive");
      }
    }
    setStep(4);
  };
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
          objetivo_podcast: objetivoPodcast,
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
    <div className="min-h-screen bg-cream text-dark">
      {/* Barra de progreso */}
      <div className="sticky top-0 z-10 border-b border-white/30 bg-cream/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold font-serif">
              <span className="text-forest">PodCast</span>
              <span className="text-muted-light">.ai</span>
            </h1>
            <span className="text-sm text-muted">Paso {step} de {TOTAL_STEPS}</span>
          </div>
          {/* Barra visual */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-full rounded-full bg-forest transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
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
              <h2 className="text-3xl font-bold font-serif text-forest">Cuéntanos sobre ti</h2>
              <p className="mt-2 text-muted">
                Personaliza tu experiencia para que cada podcast sea único
              </p>
            </div>

            {/* Formulario de datos personales */}
            <div className="glass-card space-y-4 rounded-2xl p-6">
              <div>
                <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-dark/80">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="glass-input w-full"
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
                    className="glass-input w-full"
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
                    className="glass-input w-full"
                  />
                </div>
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
                    className="glass-input w-full"
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
                    className="glass-input w-full"
                  />
                </div>
              </div>
            </div>

            {/* Picker */}
            <OptionPicker
              title="Objetivo del podcast *"
              options={OBJETIVO_OPTIONS}
              selected={objetivoPodcast}
              onSelect={setObjetivoPodcast}
              columns={3}
            />

            {/* Botón siguiente */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleSaveSurvey}
                disabled={!canGoToStep2}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-300
                  ${
                    canGoToStep2
                      ? "bg-forest text-white hover:opacity-90 shadow-lg shadow-forest/10 cursor-pointer"
                      : "bg-cream-dark text-muted-light cursor-not-allowed"
                  }
                `}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ========== PASO 2: Horario de escucha ========== */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-serif text-forest">¿Cuándo quieres escuchar?</h2>
              <p className="mt-2 text-muted">
                Configura tu horario ideal y te enviaremos una notificación para que no te pierdas tu momento podcast.
              </p>
            </div>

            {/* Hora de escucha */}
            <div className="glass-card space-y-4 rounded-2xl p-6">
              <h3 className="text-lg font-semibold font-serif text-forest">Hora de escucha</h3>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={horaEscucha}
                  onChange={(e) => setHoraEscucha(e.target.value)}
                  className="glass-input"
                />
                <span className="text-sm text-muted">
                  Tu podcast estará listo a esta hora
                </span>
              </div>
            </div>

            {/* Periodicidad */}
            <div className="glass-card space-y-4 rounded-2xl p-6">
              <h3 className="text-lg font-semibold font-serif text-forest">Periodicidad</h3>
              <div className="flex flex-wrap gap-2">
                {PERIODICIDAD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectPeriodicidad(opt.value)}
                    className={`
                      flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 cursor-pointer
                      ${
                        periodicidad === opt.value
                          ? "bg-forest text-white"
                          : "bg-cream text-dark/80 hover:bg-forest/10"
                      }
                    `}
                  >
                    {periodicidad === opt.value && (
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Descripción de la opción seleccionada */}
              {periodicidad && (
                <p className="text-sm text-muted">
                  {PERIODICIDAD_OPTIONS.find((o) => o.value === periodicidad)?.desc}
                </p>
              )}

              {/* Días personalizados */}
              {periodicidad === "personalizado" && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-dark/80">
                    Selecciona los días:
                  </p>
                  <div className="flex gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia.value}
                        type="button"
                        onClick={() => toggleDia(dia.value)}
                        className={`
                          flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer
                          ${
                            diasPersonalizados.includes(dia.value)
                              ? "bg-forest text-white"
                              : "bg-cream text-dark/80 hover:bg-forest/10"
                          }
                        `}
                      >
                        {dia.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex flex-col items-center gap-3 pt-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-full border border-white/40 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest cursor-pointer"
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleConfirmSchedule}
                  disabled={!canConfirmSchedule}
                  className={`
                    rounded-full px-8 py-3 text-lg font-semibold transition-all duration-300
                    ${
                      canConfirmSchedule
                        ? "bg-forest text-white hover:opacity-90 shadow-lg shadow-forest/10 cursor-pointer"
                        : "bg-cream-dark text-muted-light cursor-not-allowed"
                    }
                  `}
                >
                  Confirmar horario
                </button>
              </div>
              <button
                onClick={handleSkipSchedule}
                className="text-sm text-muted-light underline underline-offset-2 transition-all duration-300 hover:text-forest cursor-pointer"
              >
                Ahora no, configurar más tarde
              </button>
            </div>
          </div>
        )}

        {/* ========== PASO 3: Elegir temas ========== */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-serif text-forest">Elige tus temas de interés</h2>
              <p className="mt-2 text-muted">
                Selecciona los subtemas que te interesen de cada categoría
              </p>
            </div>

            {/* AI suggestion button */}
            {!suggestionsApplied && (
              <div className="flex justify-center">
                <button
                  onClick={handleSuggestTopics}
                  disabled={suggestingTopics}
                  className="cursor-pointer rounded-full border border-forest/30 px-5 py-2 text-sm font-medium text-forest transition-all duration-300 hover:bg-forest/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestingTopics ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-forest border-t-transparent" />
                      Analizando tu perfil...
                    </span>
                  ) : (
                    "✨ ¿Quieres que te sugiramos temas?"
                  )}
                </button>
              </div>
            )}

            {/* Contador de selección */}
            <div className="flex justify-center">
              <span
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  totalSelected >= 1
                    ? "bg-forest/10 text-dark"
                    : "bg-cream-dark text-muted"
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
                  suggested={suggestedCategories.includes(category.id)}
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
                onClick={() => setStep(2)}
                className="rounded-full border border-white/40 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest cursor-pointer"
              >
                ← Atrás
              </button>
              <button
                onClick={goToStep4}
                disabled={!canGoToStep4}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-300
                  ${
                    canGoToStep4
                      ? "bg-forest text-white hover:opacity-90 shadow-lg shadow-forest/10 cursor-pointer"
                      : "bg-cream-dark text-muted-light cursor-not-allowed"
                  }
                `}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ========== PASO 4: Duración y tono ========== */}
        {step === 4 && (
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-serif text-forest">Configura tu podcast</h2>
              <p className="mt-2 text-muted">
                Elige la duración y el estilo que prefieras
              </p>
            </div>

            <DurationPicker selected={duration} onSelect={setDuration} />
            <TonePicker selected={tone} onSelect={setTone} recommended={recommendedTone} />
            <VoicePicker selected={voice} onSelect={setVoice} />

            {/* Botones de navegación */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setStep(3)}
                className="rounded-full border border-white/40 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest cursor-pointer"
              >
                ← Atrás
              </button>
              <button
                onClick={handleFinish}
                disabled={!canFinish}
                className={`
                  rounded-full px-8 py-3 text-lg font-semibold transition-all duration-300
                  ${
                    canFinish
                      ? "bg-forest text-white hover:opacity-90 shadow-lg shadow-forest/10 cursor-pointer"
                      : "bg-cream-dark text-muted-light cursor-not-allowed"
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
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="text-muted">Cargando...</div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
