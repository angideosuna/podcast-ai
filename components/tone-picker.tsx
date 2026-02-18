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
}

export function TonePicker({ selected, onSelect }: TonePickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Tono del podcast</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TONOS.map((option) => (
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
            <span className="text-lg font-semibold text-white">{option.label}</span>
            <span className="text-xs text-slate-400">{option.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
