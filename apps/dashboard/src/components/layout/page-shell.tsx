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
    <section className="space-y-4">
      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Fleet Dashboard</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{description}</p>
      </header>
      {children}
    </section>
  );
}
