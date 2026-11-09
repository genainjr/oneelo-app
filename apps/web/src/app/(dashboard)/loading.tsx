import { Skeleton } from '@/components/app/skeleton';

export default function DashboardLoading() {
  return (
    <div
      className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded-lg bg-gray-200/70" />
        <Skeleton className="h-4 w-72 rounded-md bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl bg-white border border-gray-100 shadow-2xs" />
        <Skeleton className="h-28 rounded-2xl bg-white border border-gray-100 shadow-2xs" />
        <Skeleton className="h-28 rounded-2xl bg-white border border-gray-100 shadow-2xs" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-20 rounded-2xl bg-white border border-gray-100 shadow-2xs" />
        <Skeleton className="h-20 rounded-2xl bg-white border border-gray-100 shadow-2xs" />
      </div>
    </div>
  );
}
