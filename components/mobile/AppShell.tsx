'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shared/cn';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Tabbar } from './Tabbar';

export interface AppShellProps {
  title?: string;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center';
  transparentHeader?: boolean;
  hideHeader?: boolean;
  hideTabbar?: boolean;
}

export function AppShell({ title, subtitle, leftSlot, rightSlot, children, className, align = 'left', transparentHeader = false, hideHeader = false, hideTabbar = false }: AppShellProps) {
  const pathname = usePathname();
  const showTabbar = !hideTabbar && !(pathname.startsWith('/login') || pathname.startsWith('/onboarding'));
  const titleBlockClass = align === 'center' ? 'min-w-0 flex-1 text-center' : 'min-w-0 flex-1 text-left';

  // Reveal a divider/shadow under the sticky header only once the page scrolls.
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[color:var(--color-fg)]">
      <OfflineBanner />
      {!hideHeader && (
        <header
          className={cn(
            'sticky top-0 z-[var(--z-sticky)] flex min-h-14 items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] pt-[calc(var(--space-5)+env(safe-area-inset-top))] border-b border-transparent transition-[box-shadow,border-color] duration-200',
            transparentHeader ? 'bg-transparent' : 'bg-[var(--color-bg)]',
            !transparentHeader && scrolled && 'border-[color:var(--color-border-light)] shadow-[var(--shadow-soft-sm)]'
          )}
        >
          {leftSlot && <div className="min-w-10">{leftSlot}</div>}
          <div className={titleBlockClass}>
            {title && (
              <h1 className="truncate text-[length:var(--text-2xl)] font-bold leading-[var(--leading-tight)] text-[color:var(--color-fg-strong)]">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-1 truncate text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
                {subtitle}
              </p>
            )}
          </div>
          {rightSlot && <div className="min-w-10">{rightSlot}</div>}
        </header>
      )}
      <main className={cn('mx-auto w-full max-w-3xl px-[var(--space-4)] py-[var(--space-4)]', hideHeader && 'pt-0', showTabbar && 'pb-[calc(5rem+env(safe-area-inset-bottom))]', className)}>
        {children}
      </main>
      {showTabbar && <Tabbar />}
    </div>
  );
}
