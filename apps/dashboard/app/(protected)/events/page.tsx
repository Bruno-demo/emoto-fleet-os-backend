import { PageShell } from '@/components/layout/page-shell';

export default function EventsPage() {
  return (
    <PageShell
      title="Events"
      description="Filtered fleet event feed scaffold (connect to /events next)."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-ink-soft">
          Prepare table filters for severity, type, bike and time range.
        </p>
      </section>
    </PageShell>
  );
}
