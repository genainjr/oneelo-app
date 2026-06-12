import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalShellProps {
  isOpen: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
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
  bodyClassName,
  contentClassName,
  closeLabel = 'Fechar',
}: ModalShellProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200',
          sizeClass[size],
          contentClassName,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-800">{title}</h2>
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

        <div className={cn('max-h-[75vh] overflow-y-auto', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModalErrorProps {
  children: React.ReactNode;
}

export function ModalError({ children }: ModalErrorProps) {
  return (
    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
      {children}
    </div>
  );
}

