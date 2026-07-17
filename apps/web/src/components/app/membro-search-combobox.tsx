"use client";

import { useEffect, useRef, useState } from "react";
import { includesNormalizedText } from "@/lib/utils";

export interface MembroOption {
  id: string;
  nome: string;
  email?: string | null;
}

interface MembroSearchComboboxProps {
  label: string;
  optionalLabel?: string;
  placeholder: string;
  loading?: boolean;
  options: MembroOption[];
  selected: MembroOption | null;
  search: string;
  emptyMessage: string;
  selectedPrefix?: string;
  onSearchChange: (value: string) => void;
  onSelect: (membro: MembroOption) => void;
  onClear: () => void;
}

export function MembroSearchCombobox({
  label,
  optionalLabel,
  placeholder,
  loading = false,
  options,
  selected,
  search,
  emptyMessage,
  selectedPrefix,
  onSearchChange,
  onSelect,
  onClear,
}: MembroSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = search.trim()
    ? options.filter((m) => includesNormalizedText(m.nome, search))
    : options;

  function handleSelect(membro: MembroOption) {
    onSelect(membro);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
        {label}
        {optionalLabel && (
          <span className="text-gray-400 font-normal normal-case tracking-normal">
            {optionalLabel}
          </span>
        )}
      </label>
      <div className="relative">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={loading ? "Carregando membros..." : placeholder}
            value={search}
            disabled={loading}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
          {selected && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {open && filteredOptions.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {filteredOptions.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex flex-col"
              >
                <span className="text-sm font-semibold text-gray-800">
                  {m.nome}
                </span>
                {m.email && (
                  <span className="text-xs text-gray-400">{m.email}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {open && search.trim() && filteredOptions.length === 0 && (
          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
            {emptyMessage}
          </div>
        )}
      </div>

      {selected && selectedPrefix && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {selectedPrefix} <strong>{selected.nome}</strong>
        </p>
      )}
    </div>
  );
}
