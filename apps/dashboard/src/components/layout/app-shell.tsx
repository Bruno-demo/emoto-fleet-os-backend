'use client';

import { useEffect, useState } from 'react';
import { DashboardNav } from '@/components/layout/dashboard-nav';
import { Topbar } from '@/components/layout/topbar';
import { cx } from '@/lib/ui';

interface AppShellProps {
  children: React.ReactNode;
}

// Coordinates the responsive sidebar state and the shared top-level dashboard chrome.
export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Closes the mobile drawer automatically when the viewport grows to desktop.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        setSidebarOpen(false);
      }
    };

    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />
      <div
        className={cx(
          'min-h-screen bg-background transition-[padding] duration-300',
          sidebarCollapsed ? 'lg:pl-[92px]' : 'lg:pl-[296px]',
        )}
      >
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="px-4 py-4 md:px-5 md:py-5 xl:px-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
