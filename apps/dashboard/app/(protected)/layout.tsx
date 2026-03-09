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
        <div className="min-h-screen md:grid md:grid-cols-[280px_1fr]">
          <DashboardNav />
          <div className="min-h-screen bg-background">
            <Topbar />
            <main className="px-4 py-5 md:px-8 md:py-6">{children}</main>
          </div>
        </div>
      </RealtimeProvider>
    </RequireAuth>
  );
}
