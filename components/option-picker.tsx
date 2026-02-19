"use client";

interface PickerOption {
  value: string;
  label: string;
  emoji: string;
  descripcion?: string;
}

interface OptionPickerProps {
  title: string;
  options: PickerOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  columns?: 2 | 3 | 4;
}

const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

export function OptionPicker({
  title,
  options,
  selected,
  onSelect,
  columns = 3,
}: OptionPickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <div className={`grid grid-cols-1 gap-3 ${GRID_COLS[columns]}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`
              flex flex-col items-center gap-2 rounded-2xl border-2 p-5
              transition-all duration-200 cursor-pointer
              ${
                selected === option.value
                  ? "border-stone-900 bg-stone-800/8 shadow-md shadow-stone-300/50"
                  : "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50"
              }
            `}
          >
            <span className="text-2xl">{option.emoji}</span>
            <span className="text-lg font-semibold text-stone-900">
              {option.label}
            </span>
            {option.descripcion && (
              <span className="text-xs text-stone-500">
                {option.descripcion}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
