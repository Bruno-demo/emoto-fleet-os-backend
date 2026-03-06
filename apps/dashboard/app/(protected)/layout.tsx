import { RequireAuth } from '@/components/auth/require-auth';
import { DashboardNav } from '@/components/layout/dashboard-nav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <div className="min-h-screen md:grid md:grid-cols-[270px_1fr]">
        <DashboardNav />
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </RequireAuth>
  );
}
