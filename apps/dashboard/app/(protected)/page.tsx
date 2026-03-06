import { PageShell } from '@/components/layout/page-shell';

export default function OverviewPage() {
  return (
    <PageShell
      title="Overview"
      description="Fleet operations snapshot for live monitoring and risk."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active Bikes" value="--" hint="Live from /live/bikes" />
        <MetricCard title="Open Incidents" value="--" hint="Crash and theft workflows" />
        <MetricCard title="Weekly Avg Score" value="--" hint="From /reports/weekly" />
        <MetricCard title="Unread Events" value="--" hint="From /events filters" />
      </div>
    </PageShell>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{title}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-soft">{hint}</p>
    </article>
  );
}
