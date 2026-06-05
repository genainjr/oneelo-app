import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ReactNode;
  color?: 'indigo' | 'emerald' | 'amber' | 'blue' | 'rose';
  loading?: boolean;
  href?: string;
}

const colorMap = {
  indigo: 'bg-indigo-50 text-indigo-600',
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
  color = 'indigo',
  loading = false,
  href,
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
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        )}
      </div>
      <div className={cn('p-2.5 rounded-xl flex-shrink-0 ml-3', colorMap[color])}>
        {icon}
      </div>
    </div>
  );

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
