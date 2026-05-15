'use client';

import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Menu, Bell, Sun, Moon, Monitor, LogOut, User, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { initials } from '@/lib/utils';
import Link from 'next/link';
import { useState } from 'react';

interface AppHeaderProps {
  onToggleSidebar: () => void;
  title?: string;
}

export function AppHeader({ onToggleSidebar, title }: AppHeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('common');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const userName = user?.name ?? 'User';
  const userInitials = initials(userName);

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
      <button
        className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {/* unread badge */}
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
      </button>

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
