import { PageShell } from '@/components/layout/page-shell';

export default function ReportsPage() {
  return (
    <PageShell
      title="Reports"
      description="Weekly fleet summary scaffold powered by `/reports/weekly`."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-ink-soft">
          Add trend charts, rider rankings and risk KPIs here.
        </p>
      </section>
    </PageShell>
  );
}
