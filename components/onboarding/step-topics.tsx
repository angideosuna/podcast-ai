"use client";

import { CATEGORIES } from "@/lib/topics";
import { CategoryCard } from "@/components/category-card";
import { OtrosSection } from "@/components/otros-section";

interface StepTopicsProps {
  selectedSubtopics: string[];
  customTopics: string[];
  expandedCategories: string[];
  suggestedCategories: string[];
  suggestingTopics: boolean;
  suggestionsApplied: boolean;
  totalSelected: number;
  onToggleExpanded: (categoryId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onToggleSubtopic: (subtopicId: string) => void;
  onAddCustomTopic: (label: string) => void;
  onRemoveCustomTopic: (label: string) => void;
  onSuggestTopics: () => void;
  canGoNext: boolean;
  onNext: () => void;
  onBack?: () => void;
}

export function StepTopics({
  selectedSubtopics,
  customTopics,
  expandedCategories,
  suggestedCategories,
  suggestingTopics,
  suggestionsApplied,
  totalSelected,
  onToggleExpanded,
  onToggleCategory,
  onToggleSubtopic,
  onAddCustomTopic,
  onRemoveCustomTopic,
  onSuggestTopics,
  canGoNext,
  onNext,
  onBack,
}: StepTopicsProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold font-sans text-forest">¿Qué te interesa?</h2>
        <p className="mt-2 text-muted">
          Elige los temas sobre los que quieres escuchar tu podcast diario
        </p>
      </div>

      {/* AI suggestion button */}
      {!suggestionsApplied && (
        <div className="flex justify-center">
          <button
            onClick={onSuggestTopics}
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
            onToggleExpand={() => onToggleExpanded(category.id)}
            onToggleCategory={() => onToggleCategory(category.id)}
            onToggleSubtopic={onToggleSubtopic}
            suggested={suggestedCategories.includes(category.id)}
          />
        ))}
      </div>

      {/* Sección Otros */}
      <OtrosSection
        customTopics={customTopics}
        onAdd={onAddCustomTopic}
        onRemove={onRemoveCustomTopic}
      />

      {/* Botones de navegación */}
      <div className="flex items-center justify-center gap-4 pt-4">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-full border border-white/[0.08] px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/30 hover:text-forest cursor-pointer"
          >
            ← Atrás
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={`
            rounded-full px-8 py-3 text-lg font-semibold transition-all duration-300
            ${
              canGoNext
                ? "bg-forest text-white hover:opacity-90 shadow-lg shadow-forest/10 cursor-pointer"
                : "bg-cream-dark text-muted-light cursor-not-allowed"
            }
          `}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
