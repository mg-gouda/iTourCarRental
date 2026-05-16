'use client';

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/shared/sidebar/app-sidebar';
import { AppHeader } from '@/components/shared/header/app-header';
import { CommandPalette } from '@/components/shared/command-palette/command-palette';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AppSidebar collapsed={sidebarCollapsed} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onToggleSidebar={() => setSidebarCollapsed((v) => !v)} onOpenCommandPalette={() => setCmdOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className={cn('mx-auto max-w-screen-2xl px-4 py-6 md:px-6 lg:px-8')}>
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
