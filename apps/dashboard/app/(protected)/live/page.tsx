import { PageShell } from '@/components/layout/page-shell';
import { LiveMapShell } from '@/components/live/live-map-shell';

export default function LivePage() {
  return (
    <PageShell
      title="Live Map"
      description="Realtime bike states streamed from Socket.IO fleet room events."
    >
      <LiveMapShell />
    </PageShell>
  );
}
