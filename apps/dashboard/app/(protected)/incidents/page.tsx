import { PageShell } from '@/components/layout/page-shell';

export default function IncidentsPage() {
  return (
    <PageShell
      title="Incidents"
      description="Incident workflow scaffold for crash and theft response."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-ink-soft">
          Connect this page to `/incidents` and incident action endpoints.
        </p>
      </section>
    </PageShell>
  );
}
