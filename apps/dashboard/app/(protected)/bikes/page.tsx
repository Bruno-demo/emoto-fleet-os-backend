import { PageShell } from '@/components/layout/page-shell';

export default function BikesPage() {
  return (
    <PageShell
      title="Bikes"
      description="Bike inventory and status list scaffold (connect to /bikes next)."
    >
      <PlaceholderTable title="Bike list" />
    </PageShell>
  );
}

function PlaceholderTable({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Empty state. Wire this view to paginated API data with React Query.
      </p>
    </section>
  );
}
