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
      {actions && <div className="mt-4 flex flex-wrap gap-3">{actions}</div>}
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
}

export function FilterActions({
  submitLabel = 'Aplicar',
  clearLabel = 'Limpar',
  reloadLabel = 'Recarregar',
  onClear,
  onReload,
  loading = false,
}: FilterActionsProps) {
  return (
    <>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <Search className="h-4 w-4" />
        {submitLabel}
      </button>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
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
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" />
          {reloadLabel}
        </button>
      )}
    </>
  );
}

