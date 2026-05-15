'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/shared/sidebar/app-sidebar';
import { AppHeader } from '@/components/shared/header/app-header';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AppSidebar collapsed={sidebarCollapsed} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className={cn('mx-auto max-w-screen-2xl px-4 py-6 md:px-6 lg:px-8')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
