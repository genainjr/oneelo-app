export const WEEKDAY_OPTIONS = [
  { key: '0', value: 0 },
  { key: '1', value: 1 },
  { key: '2', value: 2 },
  { key: '3', value: 3 },
  { key: '4', value: 4 },
  { key: '5', value: 5 },
  { key: '6', value: 6 },
] as const;

interface WeekdaySelectorProps {
  selectedDays: number[];
  onToggle: (weekday: number) => void;
  getLabel: (key: string) => string;
  ariaLabel: string;
}

export function WeekdaySelector({ selectedDays, onToggle, getLabel, ariaLabel }: WeekdaySelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {WEEKDAY_OPTIONS.map(({ key, value }) => {
        const selected = selectedDays.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(value)}
            className={`inline-flex h-8 items-center justify-center rounded-xl border px-3 text-xs font-bold transition-all select-none ${
              selected
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {getLabel(key)}
          </button>
        );
      })}
    </div>
  );
}
