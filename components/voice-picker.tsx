"use client";

interface VoiceOption {
  value: string;
  label: string;
  descripcion: string;
  emoji: string;
}

const VOCES: VoiceOption[] = [
  { value: "female", label: "Voz femenina", descripcion: "Narración con voz de mujer", emoji: "👩" },
  { value: "male", label: "Voz masculina", descripcion: "Narración con voz de hombre", emoji: "👨" },
];

interface VoicePickerProps {
  selected: string | null;
  onSelect: (voice: string) => void;
}

export function VoicePicker({ selected, onSelect }: VoicePickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-dark">Voz del narrador</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VOCES.map((option) => (
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
          </button>
        ))}
      </div>
    </div>
  );
}
