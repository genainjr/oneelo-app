'use client';

import { RotateCcw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterShellProps {
  children: React.ReactNode;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  className?: string;
  actions?: React.ReactNode;
}

export function FilterShell({ children, onSubmit, className, actions }: FilterShellProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (onSubmit) {
      onSubmit(e);
    } else {
      e.preventDefault();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm', className)}
    >
      {children}
      {actions && <div className="mt-4 flex flex-wrap items-center gap-3">{actions}</div>}
    </form>
  );
}

interface FilterActionsProps {
  submitLabel?: string;
  clearLabel?: string;
  reloadLabel?: string;
  onClear?: () => void;
  onReload?: () => void;
  loading?: boolean;
  isDebouncing?: boolean;
  showSubmit?: boolean;
}

export function FilterActions({
  submitLabel = 'Aplicar',
  clearLabel = 'Limpar',
  reloadLabel = 'Recarregar',
  onClear,
  onReload,
  loading = false,
  isDebouncing = false,
  showSubmit = false,
}: FilterActionsProps) {
  const isLoadingOrDebouncing = loading || isDebouncing;

  return (
    <>
      {showSubmit && (
        <button
          type="submit"
          disabled={isLoadingOrDebouncing}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          {submitLabel}
        </button>
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={isLoadingOrDebouncing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          {clearLabel}
        </button>
      )}
      {onReload && (
        <button
          type="button"
          onClick={onReload}
          disabled={isLoadingOrDebouncing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RotateCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {reloadLabel}
        </button>
      )}
    </>
  );
}
