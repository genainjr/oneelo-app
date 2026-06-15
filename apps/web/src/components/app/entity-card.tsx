import Link from 'next/link';
import { cn } from '@/lib/utils';

interface EntityCardProps {
  children?: React.ReactNode;
  /** Torna o card um link. */
  href?: string;
  /** Torna o card clicavel (botao). */
  onClick?: () => void;
  /** Exibe um esqueleto de carregamento. */
  loading?: boolean;
  className?: string;
}

const BASE = 'bg-white rounded-2xl border border-gray-100 p-5 shadow-sm';
const INTERACTIVE = 'transition-all hover:shadow-md hover:border-gray-200';

/**
 * Container padrao do ODS para entidades em grid e como fallback mobile do DataTable.
 * Substitui as divs sombreadas construidas manualmente nas listagens em card.
 */
export function EntityCard({ children, href, onClick, loading = false, className }: EntityCardProps) {
  if (loading) {
    return (
      <div className={cn(BASE, 'animate-pulse', className)} aria-hidden="true">
        <div className="h-4 w-1/3 bg-gray-100 rounded mb-3" />
        <div className="h-3 w-2/3 bg-gray-100 rounded mb-2" />
        <div className="h-3 w-1/2 bg-gray-100 rounded" />
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn(BASE, INTERACTIVE, 'block', className)}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(BASE, INTERACTIVE, 'block w-full text-left', className)}>
        {children}
      </button>
    );
  }

  return <div className={cn(BASE, className)}>{children}</div>;
}
