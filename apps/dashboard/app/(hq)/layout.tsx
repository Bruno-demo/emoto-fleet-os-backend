import { RequireAuth } from '@/components/auth/require-auth';
import { HqAppShell } from '@/components/hq/hq-app-shell';
import { RealtimeProvider } from '@/components/realtime/realtime-provider';

export default function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <RealtimeProvider>
        <HqAppShell>{children}</HqAppShell>
      </RealtimeProvider>
    </RequireAuth>
  );
}
