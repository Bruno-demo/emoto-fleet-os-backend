export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <header className="rounded-[28px] border border-line bg-white px-6 py-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Dispatcher Workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{description}</p>
          </div>

          <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
            Live telemetry surfaces update automatically when websocket events arrive.
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}
