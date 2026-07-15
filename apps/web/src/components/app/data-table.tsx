import { useRef } from 'react';
import { EmptyState } from './empty-state';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
  /** Habilita header clicavel para ordenacao controlada. */
  sortable?: boolean;
  /** Chave logica emitida em onSortChange (default: key). */
  sortKey?: string;
  /** Oculta a coluna abaixo do breakpoint md (estrategia A: tabela responsiva). */
  hideOnMobile?: boolean;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

type MobileBreakpoint = 'sm' | 'md' | 'lg';

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  rowKey?: keyof T | ((item: T) => string);

  // Selection
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;

  // Pagination (controlada — o DataTable nao fatia os dados, apenas exibe o rodape)
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  scrollOnPageChange?: boolean;

  // Ordenacao (controlada — o DataTable nao ordena os dados, apenas emite o evento)
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;

  // Responsividade (estrategia B — card no mobile)
  renderMobileCard?: (item: T) => React.ReactNode;
  mobileBreakpoint?: MobileBreakpoint;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

const DESKTOP_SHOW: Record<MobileBreakpoint, string> = {
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
};

const MOBILE_HIDE: Record<MobileBreakpoint, string> = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
};

function SortCaret({ active, direction }: { active: boolean; direction?: 'asc' | 'desc' }) {
  return (
    <svg
      className={cn(
        'h-3 w-3 shrink-0 transition-transform',
        active ? 'text-indigo-600' : 'text-gray-300',
        active && direction === 'asc' && 'rotate-180',
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  rowKey = 'id' as keyof T,
  selectedIds,
  onSelectChange,
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  scrollOnPageChange = true,
  sort,
  onSortChange,
  renderMobileCard,
  mobileBreakpoint = 'md',
  emptyTitle = 'Nenhum resultado encontrado',
  emptyDescription = 'Tente ajustar os seus filtros de busca.',
  emptyAction,
}: DataTableProps<T>) {
  const tableRef = useRef<HTMLDivElement>(null);

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

  const handleSort = (key: string) => {
    if (!onSortChange) return;
    const direction = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, direction });
  };

  const handlePageChange = (page: number) => {
    onPageChange?.(page);

    if (scrollOnPageChange && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const dashboardScrollContainer = tableRef.current?.closest<HTMLElement>(
          '[data-dashboard-scroll-container]',
        );

        if (dashboardScrollContainer) {
          dashboardScrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  const allSelected = data.length > 0 && selectedIds?.length === data.length;
  const someSelected = selectedIds && selectedIds.length > 0 && selectedIds.length < data.length;

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const hasMobile = !!renderMobileCard;

  return (
    <div ref={tableRef} className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className={cn('overflow-x-auto', hasMobile && DESKTOP_SHOW[mobileBreakpoint])}>
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
              {columns.map((col) => {
                const colSortKey = col.sortKey ?? col.key;
                const isSorted = sort?.key === colSortKey;
                const sortable = col.sortable && onSortChange;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'p-4 text-xs font-semibold text-gray-500 tracking-wider uppercase',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(colSortKey)}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 transition-colors"
                      >
                        {col.header}
                        <SortCaret active={!!isSorted} direction={isSorted ? sort?.direction : undefined} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
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
                    <td key={col.key} className={cn('p-4', col.hideOnMobile && 'hidden md:table-cell')}>
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
                        className={cn(
                          'p-4 text-sm text-gray-600',
                          col.hideOnMobile && 'hidden md:table-cell',
                          col.className,
                        )}
                      >
                        {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile — cards (estrategia B); ativo apenas quando renderMobileCard e fornecido */}
      {hasMobile && (
        <div className={cn(MOBILE_HIDE[mobileBreakpoint], 'divide-y divide-gray-100')}>
          {loading ? (
            Array.from({ length: itemsPerPage || 3 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            ))
          ) : data.length === 0 ? (
            <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
          ) : (
            data.map((item) => (
              <div key={getRowId(item)}>{renderMobileCard!(item)}</div>
            ))
          )}
        </div>
      )}

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
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Anterior
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
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
