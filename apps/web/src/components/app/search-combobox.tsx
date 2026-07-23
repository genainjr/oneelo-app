'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { includesNormalizedText } from '@/lib/utils';

export interface SearchComboboxOption {
  id: string;
  nome: string;
}

interface SearchComboboxProps<T extends SearchComboboxOption> {
  label: string;
  optionalLabel?: string;
  placeholder: string;
  loadingPlaceholder: string;
  loading?: boolean;
  options: T[];
  selected?: T | null;
  search: string;
  emptyMessage: string;
  selectedPrefix?: string;
  getDisplayText?: (option: T) => string;
  getSecondaryText?: (option: T) => string | null | undefined;
  onSearchChange: (value: string) => void;
  onSelect: (option: T) => void;
  onClear: () => void;
}

export function SearchCombobox<T extends SearchComboboxOption>({
  label,
  optionalLabel,
  placeholder,
  loadingPlaceholder,
  loading = false,
  options,
  selected = null,
  search,
  emptyMessage,
  selectedPrefix,
  getDisplayText,
  getSecondaryText,
  onSearchChange,
  onSelect,
  onClear,
}: SearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listboxId = `${inputId}-options`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = search.trim()
    ? options.filter((option) => includesNormalizedText(getDisplayText?.(option) ?? option.nome, search))
    : options;

  function handleSelect(option: T) {
    onSelect(option);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-700">
        {label}
        {optionalLabel && <span className="font-normal normal-case tracking-normal text-gray-400">{optionalLabel}</span>}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          type="text"
          placeholder={loading ? loadingPlaceholder : placeholder}
          value={search}
          disabled={loading}
          onChange={(event) => {
            onSearchChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm transition-all focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-50"
        />
        {selected && (
          <button type="button" onClick={onClear} aria-label="Limpar seleção" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}

        {open && filteredOptions.length > 0 && (
          <div id={listboxId} role="listbox" className="absolute top-full z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {filteredOptions.map((option) => {
              const secondaryText = getSecondaryText?.(option);
              const displayText = getDisplayText?.(option) ?? option.nome;
              return (
                <button key={option.id} type="button" role="option" aria-selected={selected?.id === option.id} onClick={() => handleSelect(option)} className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-indigo-50">
                  <span className="text-sm font-semibold text-gray-800">{displayText}</span>
                  {secondaryText && <span className="text-xs text-gray-400">{secondaryText}</span>}
                </button>
              );
            })}
          </div>
        )}

        {open && filteredOptions.length === 0 && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-lg">
            {emptyMessage}
          </div>
        )}
      </div>

      {selected && selectedPrefix && (
        <p className="flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          {selectedPrefix} <strong>{getDisplayText?.(selected) ?? selected.nome}</strong>
        </p>
      )}
    </div>
  );
}
