import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './modal-shell';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const variantClass = {
  danger: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      title={title}
      icon={<AlertTriangle className="h-5 w-5" />}
      onClose={onCancel}
      size="sm"
      bodyClassName="p-6"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl transition-all disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60',
              variantClass[variant],
            )}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-6 text-gray-600">{description}</div>
    </ModalShell>
  );
}

