export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}

export function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[1200] grid w-full max-w-sm gap-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={`rounded-xl border px-3 py-2 shadow-lg ${
            item.tone === 'danger'
              ? 'border-rose-200 bg-rose-50'
              : item.tone === 'warning'
                ? 'border-amber-200 bg-amber-50'
                : item.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-sky-200 bg-sky-50'
          }`}
        >
          <p className="text-sm font-semibold text-ink">{item.title}</p>
          <p className="mt-1 text-xs text-ink-soft">{item.message}</p>
        </article>
      ))}
    </div>
  );
}
