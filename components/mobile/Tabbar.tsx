'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shared/cn';

interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface TabbarProps {
  activeHref?: string;
  fixed?: boolean;
}

const items: TabItem[] = [
  { label: '时光', href: '/timeline', icon: <PathIcon path="M4 6h16M7 12h10M9 18h6" /> },
  { label: '画廊', href: '/gallery', icon: <PathIcon path="M5 6h14v12H5zM8 15l3-3 2 2 2-3 3 4" /> },
  { label: '日历', href: '/calendar', icon: <PathIcon path="M6 5h12v14H6zM9 3v4M15 3v4M6 10h12" /> },
  { label: '我的', href: '/profile', icon: <PathIcon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /> }
];

export function Tabbar({ activeHref, fixed = true }: TabbarProps = {}) {
  const pathname = usePathname();
  const currentPath = activeHref ?? pathname;

  return (
    <nav
      className={cn(
        'tabbar',
        fixed && 'fixed bottom-0 left-0 right-0 z-[var(--z-tabbar)] pb-[calc(6px+env(safe-area-inset-bottom))]'
      )}
      aria-label="主导航"
    >
      {items.map((item) => {
        const active = !item.disabled && (currentPath === item.href || currentPath.startsWith(`${item.href}/`));
        const className = cn('tab', active && 'active', item.disabled && 'cursor-not-allowed opacity-45');

        if (item.disabled) {
          return (
            <span key={item.href} className={className} aria-disabled="true">
              <span className="dot">{item.icon}</span>
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={className}
            aria-current={active ? 'page' : undefined}
          >
            <span className="dot">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
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
