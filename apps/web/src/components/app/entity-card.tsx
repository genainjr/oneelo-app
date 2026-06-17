import { cn } from '@/lib/utils';

interface EntityCardProps {
  // Convenience props — renders standard layout
  title?: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;

  // Full control — renders children directly inside container (shell mode)
  children?: React.ReactNode;

  // Interaction
  onClick?: () => void;

  // State
  loading?: boolean;

  // Overrides
  className?: string;
}

export function EntityCard({
  title,
  subtitle,
  description,
  badge,
  meta,
  footer,
  actions,
  children,
  onClick,
  loading = false,
  className,
}: EntityCardProps) {
  const containerClass = cn(
    'bg-white rounded-2xl border border-gray-100 shadow-sm transition-all',
    !loading && 'hover:shadow-md',
    onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
    className
  );

  if (loading) {
    return (
      <div className={cn(containerClass, 'p-5 animate-pulse')} aria-busy="true">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="h-5 bg-gray-200 rounded-lg w-1/2" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-4/5" />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="h-8 bg-gray-200 rounded-xl w-24" />
        </div>
      </div>
    );
  }

  const hasConvenienceProps = title !== undefined || subtitle !== undefined || badge !== undefined ||
    description !== undefined || meta !== undefined || footer !== undefined || actions !== undefined;

  // Shell mode: wrap children directly, no opinionated layout
  if (!hasConvenienceProps) {
    return (
      <div
        className={containerClass}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {children}
      </div>
    );
  }

  // Standard layout mode
  return (
    <div
      className={cn(containerClass, 'flex flex-col p-5 gap-3')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || subtitle || badge) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-base font-bold text-gray-800 leading-snug">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}

      {description && (
        <p className="text-sm text-gray-500 line-clamp-2">{description}</p>
      )}

      {meta && (
        <div className="text-xs text-gray-400">{meta}</div>
      )}

      {children}

      {(footer || actions) && (
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-auto">
          <div className="min-w-0 flex-1">{footer}</div>
          {actions && <div className="shrink-0 flex gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
