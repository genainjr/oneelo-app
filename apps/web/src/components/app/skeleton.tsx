import { cn } from '@/lib/utils';

interface SkeletonProps {
  /** Classes de tamanho/forma (altura, largura, raio, cor). */
  className?: string;
}

/**
 * Bloco de carregamento (shimmer) padrao do ODS. Presentation-only.
 * Base: `animate-pulse rounded-lg bg-gray-100`. Sobrescreva via `className`
 * (ex.: `h-32`, `rounded-2xl`, `bg-gray-50`).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-100', className)}
      aria-hidden="true"
    />
  );
}

interface SkeletonListProps {
  /** Quantidade de blocos. Padrao 3. */
  count?: number;
  /** Classes aplicadas a cada bloco (altura/forma). Padrao `h-20`. */
  className?: string;
  /** Espacamento vertical entre os blocos. Padrao `space-y-3`. */
  gap?: string;
}

/**
 * Lista vertical de blocos skeleton — placeholder de uma listagem em carregamento
 * (ex.: cards de escalas, linhas de detalhe). Usa `Skeleton` internamente.
 */
export function SkeletonList({ count = 3, className, gap = 'space-y-3' }: SkeletonListProps) {
  return (
    <div className={gap} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('h-20', className)} />
      ))}
    </div>
  );
}
