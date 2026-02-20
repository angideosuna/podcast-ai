"use client";

import type { Category } from "@/lib/topics";

interface CategoryCardProps {
  category: Category;
  expanded: boolean;
  selectedSubtopics: string[];
  onToggleExpand: () => void;
  onToggleCategory: () => void;
  onToggleSubtopic: (subtopicId: string) => void;
  suggested?: boolean;
}

export function CategoryCard({
  category,
  expanded,
  selectedSubtopics,
  onToggleExpand,
  onToggleCategory,
  onToggleSubtopic,
  suggested,
}: CategoryCardProps) {
  const allIds = category.subtopics.map((s) => s.id);
  const selectedCount = allIds.filter((id) => selectedSubtopics.includes(id)).length;
  const allSelected = selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="overflow-hidden rounded-2xl glass-card transition-shadow duration-300 hover:shadow-md hover:shadow-forest/5">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-3 px-5 py-4"
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCategory();
          }}
          className={`
            flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-300 cursor-pointer
            ${
              allSelected
                ? "border-forest bg-forest text-white"
                : someSelected
                  ? "border-forest bg-forest text-white"
                  : "border-cream-dark bg-cream-light/60 hover:border-forest/40"
            }
          `}
          aria-label={`Seleccionar todos los subtemas de ${category.nombre}`}
        >
          {allSelected && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {someSelected && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Emoji + nombre */}
        <span className="text-2xl">{category.emoji}</span>
        <span className="flex-1 text-lg font-semibold text-dark">
          {category.nombre}
          {suggested && (
            <span className="ml-2 inline-block rounded-full bg-forest/10 px-2 py-0.5 align-middle text-[10px] font-medium text-forest">
              Sugerido para ti
            </span>
          )}
        </span>

        {/* Contador */}
        {selectedCount > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">
            {selectedCount}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={`h-5 w-5 text-muted transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Panel expandible */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2 px-5 pb-4 pt-1">
            {category.subtopics.map((sub) => {
              const isSelected = selectedSubtopics.includes(sub.id);
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onToggleSubtopic(sub.id)}
                  className={`
                    rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300 cursor-pointer
                    ${
                      isSelected
                        ? "bg-forest text-white shadow-md shadow-forest/10"
                        : "bg-cream-dark/50 text-dark/70 hover:bg-cream-dark hover:text-dark"
                    }
                  `}
                >
                  {sub.nombre}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
