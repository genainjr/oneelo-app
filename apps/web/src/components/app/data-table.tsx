import { EmptyState } from './empty-state';
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
  rowKey?: keyof T | ((item: T) => string);
  
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
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  rowKey = 'id' as any,
  selectedIds,
  onSelectChange,
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  emptyTitle = 'Nenhum resultado encontrado',
  emptyDescription = 'Tente ajustar os seus filtros de busca.',
  emptyAction,
}: DataTableProps<T>) {
  
  const getRowId = (item: T): string => {
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

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
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
              // Loading skeletons
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
                        {col.render ? col.render(item) : (item[col.key as keyof T] as any)}
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
}
