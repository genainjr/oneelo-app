import { cn } from '@/lib/utils';

interface CreationModeOption<T extends string> {
  id: T;
  title: string;
  description: string;
}

interface CreationModeSelectorProps<T extends string> {
  legend: string;
  options: readonly CreationModeOption<T>[];
  selected: T;
  onChange: (mode: T) => void;
  columns?: 2 | 3;
}

export function CreationModeSelector<T extends string>({
  legend,
  options,
  selected,
  onChange,
  columns = 2,
}: CreationModeSelectorProps<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase text-gray-500">{legend}</legend>
      <div className={cn('grid gap-2', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {options.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                active
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200',
              )}
            >
              <span className="block text-sm font-semibold">{option.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500">{option.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
