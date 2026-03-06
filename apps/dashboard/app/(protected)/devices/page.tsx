import { PageShell } from '@/components/layout/page-shell';

export default function DevicesPage() {
  return (
    <PageShell
      title="Devices"
      description="Provisioned device list scaffold (connect to /devices next)."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-ink-soft">
          Empty state for device inventory, assignment and secret rotation history.
        </p>
      </section>
    </PageShell>
  );
}
