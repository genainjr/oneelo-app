'use client';

import { LucideIcon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estilo unico dos campos da barra de filtros (FilterShell) do ODS.
 * Mais compacto que os campos de formulario/modal (form-field.tsx):
 * `px-3 py-2 rounded-lg`. Sobrescreva pontualmente via `className`.
 */
export const filterFieldClass =
  'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all';

function FilterLabel({ htmlFor, label }: { htmlFor?: string; label: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}
    </label>
  );
}

type FilterInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Rotulo opcional (uppercase) exibido acima do campo. */
  label?: string;
  /** Icone opcional exibido a esquerda do input. Se omitido e type === 'search', usa Search como padrao. */
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
};

/** Input de filtro padronizado. Sem `label`, renderiza apenas o input. */
export function FilterInput({ label, className, id, icon, ...props }: FilterInputProps) {
  const Icon = icon ?? (props.type === 'search' ? Search : undefined);

  const input = (
    <input
      id={id}
      className={cn(
        filterFieldClass,
        Icon && 'pl-9',
        props.type === 'search' &&
          '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
        className,
      )}
      {...props}
    />
  );

  const content = Icon ? (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      {input}
    </div>
  ) : (
    input
  );

  if (!label) return content;
  return (
    <div className="space-y-1.5">
      <FilterLabel htmlFor={id} label={label} />
      {content}
    </div>
  );
}

type FilterSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Rotulo opcional (uppercase) exibido acima do campo. */
  label?: string;
  children: React.ReactNode;
};

/** Select de filtro padronizado. Sem `label`, renderiza apenas o select. */
export function FilterSelect({ label, className, id, children, ...props }: FilterSelectProps) {
  const select = (
    <select id={id} className={cn(filterFieldClass, className)} {...props}>
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <div className="space-y-1.5">
      <FilterLabel htmlFor={id} label={label} />
      {select}
    </div>
  );
}
