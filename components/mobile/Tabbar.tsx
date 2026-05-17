'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const items: TabItem[] = [
  { label: '时光', href: '/timeline', icon: <PathIcon path="M4 6h16M7 12h10M9 18h6" /> },
  { label: '画廊', href: '/gallery', icon: <PathIcon path="M5 6h14v12H5zM8 15l3-3 2 2 2-3 3 4" />, disabled: true },
  { label: '日历', href: '/calendar', icon: <PathIcon path="M6 5h12v14H6zM9 3v4M15 3v4M6 10h12" />, disabled: true },
  { label: '我的', href: '/profile', icon: <PathIcon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /> }
];

export function Tabbar() {
  const pathname = usePathname();

  return (
    <nav className="bl-tabbar fixed bottom-0 left-0 right-0 z-[var(--z-tabbar)] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] pb-[calc(var(--space-2)+env(safe-area-inset-bottom))] pt-[var(--space-2)] shadow-[var(--shadow-card)]" aria-label="主导航">
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-[var(--space-2)]">
        {items.map((item) => {
          const active = !item.disabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const className = cn(
            'flex min-h-12 flex-col items-center justify-center gap-1 rounded-[var(--radius-pill)] text-[var(--text-xs)] font-bold transition-[background-color,transform,color] duration-[var(--duration-normal)] text-[var(--color-muted)] motion-reduce:transition-none',
            active && 'translate-y-[-6px] bg-[var(--color-accent)] text-[color:var(--color-on-solid)] motion-reduce:translate-y-0',
            item.disabled && 'cursor-not-allowed opacity-45'
          );

          return (
            <li key={item.href}>
              {item.disabled ? (
                <span className={className} aria-disabled="true" style={active ? { color: 'var(--color-on-solid)' } : undefined}>
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={className}
                  aria-current={active ? 'page' : undefined}
                  style={active ? { color: 'var(--color-on-solid)' } : undefined}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PathIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d={path} />
    </svg>
  );
}
