'use client';

import { cx } from '@/lib/ui';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalItems?: number;
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  pageSize = 15,
  onPageSizeChange,
  totalItems,
}: PaginationControlsProps) {
  const canGoBack = page > 1;
  const canGoNext = page < totalPages;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems ?? 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-line mt-4">
      {/* Left side: Item count */}
      {totalItems !== undefined ? (
        <div className="text-xs text-ink-muted">
          Showing <span className="font-semibold text-ink">{startItem}</span> to{' '}
          <span className="font-semibold text-ink">{endItem}</span> of{' '}
          <span className="font-semibold text-ink">{totalItems}</span> entries
        </div>
      ) : (
        <div />
      )}

      {/* Right side: Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent"
            >
              {[15, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Go to page selector */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span>Go to</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= totalPages) {
                  onPageChange(val);
                }
              }}
              className="w-12 rounded-lg border border-line bg-surface px-1.5 py-1 text-center text-xs text-ink focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cx(
              'rounded-lg border border-line bg-surface hover:bg-surface-hover active:bg-surface-active px-3 py-1.5 text-xs font-semibold text-ink-soft transition-all disabled:opacity-40 disabled:hover:bg-surface disabled:active:bg-surface'
            )}
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoBack}
          >
            Previous
          </button>
          <span className="text-xs text-ink-muted select-none">
            Page <span className="font-semibold text-ink">{page}</span> / {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            className={cx(
              'rounded-lg border border-line bg-surface hover:bg-surface-hover active:bg-surface-active px-3 py-1.5 text-xs font-semibold text-ink-soft transition-all disabled:opacity-40 disabled:hover:bg-surface disabled:active:bg-surface'
            )}
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
