import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  /** Texto/label do status. Resolva o label via lib/utils (STATUS_*_LABEL). */
  label: React.ReactNode;
  /** Classes de cor do status. Resolva via lib/utils (STATUS_*_COLOR) ou mapa do modulo. */
  className?: string;
}

/**
 * Pill de status padronizada do ODS.
 * Componente presentation-only: nao conhece dominio.
 * As cores e labels devem vir de `lib/utils` (STATUS_*_COLOR / STATUS_*_LABEL).
 * A base usa `rounded-full`; passe `rounded-lg`/`border` no className para variar.
 */
export function StatusBadge({ label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full',
        className,
      )}
    >
      {label}
    </span>
  );
}
