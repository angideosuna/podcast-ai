"use client";

interface DurationOption {
  value: number;
  label: string;
  descripcion: string;
  emoji: string;
}

const DURACIONES: DurationOption[] = [
  { value: 5, label: "Express", descripcion: "Resumen rápido de lo esencial", emoji: "⚡" },
  { value: 15, label: "Estándar", descripcion: "Balance perfecto de profundidad", emoji: "☕" },
  { value: 30, label: "Deep Dive", descripcion: "Análisis completo y detallado", emoji: "🎧" },
];

interface DurationPickerProps {
  selected: number | null;
  onSelect: (duration: number) => void;
}

export function DurationPicker({ selected, onSelect }: DurationPickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Duración del podcast</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DURACIONES.map((option) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`
              flex flex-col items-center gap-2 rounded-xl border-2 p-5
              transition-all duration-200 cursor-pointer
              ${
                selected === option.value
                  ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800"
              }
            `}
          >
            <span className="text-2xl">{option.emoji}</span>
            <span className="text-2xl font-bold text-white">{option.value} min</span>
            <span className="text-sm font-medium text-violet-400">{option.label}</span>
            <span className="text-xs text-slate-400">{option.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
