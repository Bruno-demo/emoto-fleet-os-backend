import { PageShell } from '@/components/layout/page-shell';

export default function ZonesPage() {
  return (
    <PageShell
      title="Zones"
      description="Geofence management scaffold for SLOW, PARK and NO_GO areas."
    >
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-ink-soft">
          Add zone CRUD forms and map editor in the next implementation pass.
        </p>
      </section>
    </PageShell>
  );
}
