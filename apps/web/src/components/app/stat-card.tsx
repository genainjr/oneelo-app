import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ReactNode;
  color?: 'brand' | 'indigo' | 'emerald' | 'amber' | 'blue' | 'rose';
  loading?: boolean;
  href?: string;
  action?: React.ReactNode;
}

const colorMap = {
  brand: 'bg-stat-brand-bg text-stat-brand-text',
  indigo: 'bg-stat-brand-bg text-stat-brand-text',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  rose: 'bg-rose-50 text-rose-600',
};

export function StatCard({
  title,
  value,
  description,
  icon,
  color = 'brand',
  loading = false,
  href,
  action,
}: StatCardProps) {
  const content = (
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        {loading ? (
          <div className="mt-2 h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        )}
        {description && (
          <p className="mt-1 whitespace-pre-line text-xs text-gray-400">{description}</p>
        )}
      </div>
      <div className={cn('p-2.5 rounded-xl flex-shrink-0 ml-3', colorMap[color])}>
        {icon}
      </div>
    </div>
  );

  if (action) {
    return (
      <div className="flex flex-col justify-between bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
        {href ? (
          <Link href={href} className="block group cursor-pointer focus-visible:outline-none">
            {content}
          </Link>
        ) : (
          content
        )}
        <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-end">
          {action}
        </div>
      </div>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      {content}
    </div>
  );
}
