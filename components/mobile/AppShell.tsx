'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Tabbar } from './Tabbar';

export interface AppShellProps {
  title: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ title, leftSlot, rightSlot, children, className }: AppShellProps) {
  const pathname = usePathname();
  const showTabbar = !(pathname.startsWith('/login') || pathname.startsWith('/onboarding'));

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <OfflineBanner />
      <header className="sticky top-0 z-[var(--z-sticky)] flex min-h-14 items-center justify-between gap-[var(--space-3)] bg-[var(--color-bg)] px-[var(--space-4)] pt-[env(safe-area-inset-top)]">
        <div className="min-w-10">{leftSlot}</div>
        <h1 className="text-center text-[var(--text-2xl)] font-bold text-[var(--color-fg-strong)]">{title}</h1>
        <div className="min-w-10">{rightSlot}</div>
      </header>
      <main className={cn('mx-auto w-full max-w-3xl px-[var(--space-4)] py-[var(--space-4)]', showTabbar && 'pb-[calc(5rem+env(safe-area-inset-bottom))]', className)}>
        {children}
      </main>
      {showTabbar && <Tabbar />}
    </div>
  );
}
