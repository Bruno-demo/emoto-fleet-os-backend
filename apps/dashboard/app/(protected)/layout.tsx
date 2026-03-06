import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardNav } from '@/components/layout/dashboard-nav';
import { Topbar } from '@/components/layout/topbar';
import { RealtimeProvider } from '@/components/realtime/realtime-provider';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <RealtimeProvider>
        <div className="min-h-screen md:grid md:grid-cols-[270px_1fr]">
          <DashboardNav />
          <div className="min-h-screen bg-background">
            <Topbar />
            <main className="p-4 md:p-8">{children}</main>
          </div>
        </div>
      </RealtimeProvider>
    </RequireAuth>
  );
}
