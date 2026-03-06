'use client';

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
}) {
  const canGoBack = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <button
        type="button"
        className="rounded-lg border border-line px-3 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoBack}
      >
        Previous
      </button>
      <span className="text-sm text-ink-soft">
        Page {page} / {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        className="rounded-lg border border-line px-3 py-1 text-sm disabled:opacity-50"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
      >
        Next
      </button>
    </div>
  );
}
