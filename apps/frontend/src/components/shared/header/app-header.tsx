'use client';

import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Menu, Bell, Sun, Moon, Monitor, LogOut, User, ChevronDown, Check, Trash2, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initials } from '@/lib/utils';
import Link from 'next/link';
import { useState } from 'react';
import { notificationsApi, AppNotification } from '@/lib/api';

interface AppHeaderProps {
  onToggleSidebar: () => void;
  onOpenCommandPalette?: () => void;
  title?: string;
}

export function AppHeader({ onToggleSidebar, onOpenCommandPalette, title }: AppHeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('common');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const userName = user?.name ?? 'User';
  const userInitials = initials(userName);

  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(false),
    refetchInterval: 30_000,
  });

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const { mutate: markAllRead } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const { mutate: deleteNotif } = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function notifTitle(n: AppNotification) {
    const titles: Record<string, string> = {
      BOOKING_CONFIRMED: 'Booking confirmed',
      PAYMENT_RECORDED: 'Payment recorded',
      MAINTENANCE_COMPLETED: 'Maintenance completed',
      BOOKING_CANCELLED: 'Booking cancelled',
    };
    return titles[n.kind] ?? n.kind.replace(/_/g, ' ').toLowerCase();
  }

  const themeIcons = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  const nextTheme =
    theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Page title */}
      {title && (
        <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
      )}

      {/* Command palette trigger */}
      {onOpenCommandPalette && (
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="ml-1 rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
      )}

      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(nextTheme)}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label={`Switch to ${nextTheme} theme`}
      >
        {themeIcons[theme as keyof typeof themeIcons] ?? themeIcons.system}
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-border bg-popover shadow-lg animate-fade-in overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {!notifications?.length && (
                  <div className="py-8 text-center text-xs text-muted-foreground">All caught up!</div>
                )}
                {notifications?.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors ${!n.readAt ? 'bg-primary/5' : ''}`}
                  >
                    {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />}
                    {n.readAt && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground capitalize">{notifTitle(n)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {typeof n.payload === 'object' && n.payload !== null && 'message' in n.payload
                          ? String((n.payload as Record<string, unknown>).message)
                          : JSON.stringify(n.payload)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {!n.readAt && (
                        <button onClick={() => markRead(n.id)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => deleteNotif(n.id)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          {/* Avatar */}
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {userInitials}
          </span>
          <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">
            {userName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Dropdown */}
        {userMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setUserMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-popover shadow-lg py-1 animate-fade-in">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Profile
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
