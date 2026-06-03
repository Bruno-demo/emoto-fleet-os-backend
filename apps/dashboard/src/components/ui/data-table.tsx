import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { TableRowsSkeleton } from '@/components/ui/skeleton';
import { cx } from '@/lib/ui';

export interface DataTableColumn<T> {
  header: string;
  className?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Array<DataTableColumn<T>>;
  keyExtractor: (row: T) => string;
  loading?: boolean;
  emptyState?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
}

// Standardizes table spacing, loading, and empty state behavior across pages.
export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  emptyState,
  className,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return <TableRowsSkeleton rows={5} columns={columns.length} />;
  }

  if (!data.length) {
    return (
      <div className={className}>
        {emptyState ?? (
          <EmptyState
            title="No results"
            description="No rows match the current query."
          />
        )}
      </div>
    );
  }

  return (
    <div className={cx('overflow-x-auto pb-4', className)}>
      <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm whitespace-nowrap md:whitespace-normal">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            {columns.map((column) => (
              <th key={column.header} className={cx('px-4 py-2 font-semibold', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={cx(
                'group rounded-[18px] bg-surface-muted hover:bg-surface-hover transition-colors',
                onRowClick ? 'cursor-pointer' : '',
              )}
            >
              {columns.map((column) => (
                <td
                  key={`${keyExtractor(row)}-${column.header}`}
                  className={cx(
                    'border-y border-line px-4 py-4 first:rounded-l-[18px] first:border-l last:rounded-r-[18px] last:border-r',
                    column.cellClassName,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DataTableToolbarProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

// Wraps filter controls and table actions in a consistent header block.
export function DataTableToolbar({
  title,
  description,
  actions,
  children,
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {title ? <h3 className="font-display text-2xl font-bold text-ink">{title}</h3> : null}
        {description ? <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

