"use client";

interface ToneOption {
  value: string;
  label: string;
  descripcion: string;
  emoji: string;
}

const TONOS: ToneOption[] = [
  { value: "casual", label: "Casual", descripcion: "Conversación relajada y amigable", emoji: "😊" },
  { value: "profesional", label: "Profesional", descripcion: "Formal y enfocado en datos", emoji: "👔" },
  { value: "deep-dive", label: "Deep-dive", descripcion: "Análisis técnico en profundidad", emoji: "🧠" },
];

interface TonePickerProps {
  selected: string | null;
  onSelect: (tone: string) => void;
  recommended?: string | null;
}

export function TonePicker({ selected, onSelect, recommended }: TonePickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-dark">Tono del podcast</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TONOS.map((option) => (
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
            <span className="text-lg font-semibold text-dark">{option.label}</span>
            <span className="text-xs text-muted">{option.descripcion}</span>
            {recommended === option.value && (
              <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-medium text-forest">
                Recomendado para ti
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
