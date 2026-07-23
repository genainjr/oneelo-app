import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
type ModalHeight = 'auto' | 'viewport';

// ─── ModalShell ──────────────────────────────────────────────────────────────

interface ModalShellProps {
  isOpen: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  height?: ModalHeight;
  bodyClassName?: string;
  contentClassName?: string;
  closeLabel?: string;
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function ModalShell({
  isOpen,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
  size = 'md',
  height = 'auto',
  bodyClassName,
  contentClassName,
  closeLabel = 'Fechar',
}: ModalShellProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]',
          height === 'viewport' && 'h-[92vh] sm:h-[90vh]',
          sizeClass[size],
          contentClassName,
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Header — fixed, never scrolls */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">{title}</h2>
              {description && (
                <p className="mt-0.5 text-sm text-gray-500">{description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>
          {children}
        </div>

        {/* Legacy footer slot */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 px-4 py-4 sm:px-6 border-t border-gray-100 bg-gray-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ModalError ───────────────────────────────────────────────────────────────

interface ModalErrorProps {
  /** Render a string message directly */
  message?: string | null;
  /** Or pass children for full control */
  children?: React.ReactNode;
  className?: string;
}

export function ModalError({ message, children, className }: ModalErrorProps) {
  const content = message ?? children;
  if (!content) return null;
  return (
    <div className={cn("mx-6 mt-5 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl", className)}>
      {content}
    </div>
  );
}

// ─── ModalFooter ──────────────────────────────────────────────────────────────

interface ModalFooterProps {
  /** Label for the primary submit button (default: "Salvar") */
  primaryLabel?: string;
  /** Callback for cancel button */
  onCancel: () => void;
  /** Label for the cancel button (default: "Cancelar") */
  cancelLabel?: string;
  /** Shows loading spinner and disables primary button */
  loading?: boolean;
  /** Additional disabled condition on top of loading */
  disabled?: boolean;
  /** Optional slot on the left side (e.g. "Archive" / "Delete" destructive action) */
  secondaryAction?: React.ReactNode;
  /** Form id to associate submit button with (when button is outside the form) */
  form?: string;
  /** Override submit type if needed (default: "submit") */
  type?: 'submit' | 'button';
  /** onClick for the primary action when type="button" */
  onClick?: () => void;
}

export function ModalFooter({
  primaryLabel = 'Salvar',
  onCancel,
  cancelLabel = 'Cancelar',
  loading = false,
  disabled = false,
  secondaryAction,
  form,
  type = 'submit',
  onClick,
}: ModalFooterProps) {
  return (
    <div className="flex w-full shrink-0 items-center justify-between">
      {/* Left slot — destructive secondary action */}
      <div>{secondaryAction ?? <span />}</div>

      {/* Right slot — cancel + primary */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type={type}
          form={form}
          onClick={onClick}
          disabled={loading || disabled}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
