import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  containerClassName?: string;
}

/**
 * Standard ODS reactive search input bar.
 * Includes search icon, clean rounded-xl styling, and instant clear (X) button.
 */
export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Buscar...',
  className,
  containerClassName,
  disabled,
  ...props
}: SearchInputProps) {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={cn('relative w-full', containerClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm',
          'focus:outline-none focus:border-indigo-500 focus:bg-white transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpar busca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
