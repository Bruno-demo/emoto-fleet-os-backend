export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  count?: number;
}

export function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[1200] grid w-full max-w-sm gap-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={`rounded-[20px] border px-4 py-3 shadow-[var(--shadow-soft)] ${
            item.tone === 'danger'
              ? 'border-danger-ink/20 bg-danger-soft'
              : item.tone === 'warning'
                ? 'border-warning-ink/20 bg-warning-soft'
                : item.tone === 'success'
                  ? 'border-success-ink/20 bg-success-soft'
                  : 'border-accent/20 bg-accent-soft'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            {item.count && item.count > 1 ? (
              <span className="rounded-full bg-surface-strong px-2 py-1 text-[11px] font-semibold text-ink-soft">
                x{item.count}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-soft">{item.message}</p>
        </article>
      ))}
    </div>
  );
}

