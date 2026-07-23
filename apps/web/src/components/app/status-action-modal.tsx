import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalError, ModalShell } from './modal-shell';

type StatusActionModalOption<TStatus extends string> = {
  value: TStatus;
  label: string;
  className?: string;
};

type StatusActionModalProps<TStatus extends string> = {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  options: StatusActionModalOption<TStatus>[];
  loading?: boolean;
  error?: string;
  cancelLabel?: string;
  processingLabel?: string;
  onClose: () => void;
  onSelect: (status: TStatus) => void | Promise<void>;
};

const defaultActionClass = 'border-gray-500 bg-gray-500 text-white hover:bg-gray-600';

export function StatusActionModal<TStatus extends string>({
  isOpen,
  title,
  description,
  options,
  loading = false,
  error,
  cancelLabel = 'Cancelar',
  processingLabel = 'Processando...',
  onClose,
  onSelect,
}: StatusActionModalProps<TStatus>) {
  return (
    <ModalShell
      isOpen={isOpen}
      title={title}
      icon={<AlertTriangle className="h-5 w-5" />}
      onClose={onClose}
      size="sm"
      bodyClassName="p-6"
      footer={
        <div className="ml-auto flex w-full flex-row flex-nowrap justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-150 disabled:opacity-60 sm:px-4"
          >
            {cancelLabel}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              disabled={loading}
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition-all hover:shadow disabled:opacity-60 sm:px-5 ${option.className ?? defaultActionClass}`}
            >
              {loading ? processingLabel : option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        <ModalError message={error} className="m-0" />
        <div className="text-sm leading-6 text-gray-600">{description}</div>
      </div>
    </ModalShell>
  );
}
