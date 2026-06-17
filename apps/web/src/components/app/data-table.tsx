import { EmptyState } from './empty-state';
import { EntityCard } from './entity-card';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  rowKey?: keyof T | ((item: T) => string); // defaults to 'id' field when omitted

  // Selection
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;

  // Pagination
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  // Mobile fallback — when set, replaces the table below mobileBreakpoint
  renderMobileCard?: (item: T) => React.ReactNode;
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  rowKey,
  selectedIds,
  onSelectChange,
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  emptyTitle = 'Nenhum resultado encontrado',
  emptyDescription = 'Tente ajustar os seus filtros de busca.',
  emptyAction,
  renderMobileCard,
  mobileBreakpoint = 'md',
}: DataTableProps<T>) {

  const getRowId = (item: T): string => {
    if (!rowKey) {
      return String((item as Record<string, unknown>)['id'] ?? '');
    }
    if (typeof rowKey === 'function') {
      return rowKey(item);
    }
    return String(item[rowKey]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectChange) return;
    if (checked) {
      onSelectChange(data.map(getRowId));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectChange || !selectedIds) return;
    if (checked) {
      onSelectChange([...selectedIds, id]);
    } else {
      onSelectChange(selectedIds.filter((x) => x !== id));
    }
  };

  const allSelected = data.length > 0 && selectedIds?.length === data.length;
  const someSelected = selectedIds && selectedIds.length > 0 && selectedIds.length < data.length;

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Breakpoint-specific Tailwind classes (full strings required for Tailwind's scanner)
  const mobileHideClass = mobileBreakpoint === 'sm' ? 'sm:hidden' : mobileBreakpoint === 'lg' ? 'lg:hidden' : 'md:hidden';
  const tableShowClass = mobileBreakpoint === 'sm' ? 'hidden sm:flex' : mobileBreakpoint === 'lg' ? 'hidden lg:flex' : 'hidden md:flex';

  const tableCard = (
    <div className={cn(
      'w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col',
      renderMobileCard && tableShowClass
    )}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {onSelectChange && (
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !!someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'p-4 text-xs font-semibold text-gray-500 tracking-wider uppercase',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: itemsPerPage || 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {onSelectChange && (
                    <td className="p-4 text-center">
                      <div className="w-4 h-4 bg-gray-200 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectChange ? 1 : 0)} className="p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = getRowId(item);
                const isSelected = selectedIds?.includes(id) ?? false;
                return (
                  <tr
                    key={id}
                    className={cn(
                      'hover:bg-gray-50/50 transition-colors',
                      isSelected && 'bg-indigo-50/30'
                    )}
                  >
                    {onSelectChange && (
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(id, e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn('p-4 text-sm text-gray-600', col.className)}
                      >
                        {col.render ? col.render(item) : (item[col.key as keyof T] as unknown as React.ReactNode)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalItems > 0 && onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-white">
          <div className="text-sm text-gray-500">
            Mostrando <span className="font-medium">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</span> a{' '}
            <span className="font-medium">{Math.min(totalItems, currentPage * itemsPerPage)}</span> de{' '}
            <span className="font-medium">{totalItems}</span> registros
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Anterior
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // No mobile fallback: return table card directly (same structure as before)
  if (!renderMobileCard) {
    return tableCard;
  }

  // With mobile fallback: return Fragment with mobile section + table card
  return (
    <>
      <div className={mobileHideClass}>
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: Math.min(3, itemsPerPage) }).map((_, i) => (
              <EntityCard key={i} loading />
            ))
          ) : data.length === 0 ? (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          ) : (
            data.map((item) => (
              <div key={getRowId(item)}>
                {renderMobileCard(item)}
              </div>
            ))
          )}
        </div>
      </div>

      {tableCard}
    </>
  );
}
