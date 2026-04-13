'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardNav } from '@/components/layout/dashboard-nav';
import { Topbar } from '@/components/layout/topbar';
import { apiFetch } from '@/lib/api/client';
import type { Incident, PaginatedResponse } from '@/lib/types/dashboard';
import { cx } from '@/lib/ui';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'shell-count'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=1'),
    refetchInterval: 30_000,
  });
  const openIncidentCount = incidentsQuery.data?.total ?? 0;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarOpen(false);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        openIncidentCount={openIncidentCount}
      />
      <div
        className={cx(
          'min-h-screen bg-background transition-[padding] duration-300',
          sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[272px]',
        )}
      >
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="px-4 py-5 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
