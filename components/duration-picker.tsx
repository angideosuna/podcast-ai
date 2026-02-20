"use client";

interface DurationOption {
  value: number;
  label: string;
  descripcion: string;
  emoji: string;
}

const DURACIONES: DurationOption[] = [
  { value: 15, label: "Express", descripcion: "Resumen rápido de lo esencial", emoji: "⚡" },
  { value: 30, label: "Estándar", descripcion: "Balance perfecto de profundidad", emoji: "☕" },
  { value: 60, label: "Deep Dive", descripcion: "Análisis completo y detallado", emoji: "🎧" },
];

interface DurationPickerProps {
  selected: number | null;
  onSelect: (duration: number) => void;
}

export function DurationPicker({ selected, onSelect }: DurationPickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-dark">Duración del podcast</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DURACIONES.map((option) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`
              flex flex-col items-center gap-2 rounded-2xl border p-5
              transition-all duration-300 cursor-pointer
              ${
                selected === option.value
                  ? "border-forest/30 bg-forest/10 shadow-lg shadow-forest/5"
                  : "glass-card hover:border-forest/20 hover:shadow-md hover:shadow-forest/5"
              }
            `}
          >
            <span className="text-2xl">{option.emoji}</span>
            <span className="text-2xl font-bold text-dark">{option.value >= 60 ? `${option.value / 60} hora` : `${option.value} min`}</span>
            <span className="text-sm font-medium text-muted">{option.label}</span>
            <span className="text-xs text-muted-light">{option.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
