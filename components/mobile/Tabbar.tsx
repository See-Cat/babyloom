'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shared/cn';

interface TabItem {
  label: string;
  href: string;
  iconSrc: string;
  activeIconSrc: string;
  disabled?: boolean;
}

interface TabbarProps {
  activeHref?: string;
  fixed?: boolean;
}

const items: TabItem[] = [
  {
    label: '时光',
    href: '/timeline',
    iconSrc: '/icons/tabbar/timeline.png',
    activeIconSrc: '/icons/tabbar/timeline-active.png'
  },
  {
    label: '画廊',
    href: '/gallery',
    iconSrc: '/icons/tabbar/gallery.png',
    activeIconSrc: '/icons/tabbar/gallery-active.png'
  },
  {
    label: '日历',
    href: '/calendar',
    iconSrc: '/icons/tabbar/calendar.png',
    activeIconSrc: '/icons/tabbar/calendar-active.png'
  },
  {
    label: '我的',
    href: '/profile',
    iconSrc: '/icons/tabbar/profile.png',
    activeIconSrc: '/icons/tabbar/profile-active.png'
  }
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
              <span className="dot">
                <TabIconImage src={item.iconSrc} />
              </span>
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
            <span className="dot">
              <TabIconImage src={active ? item.activeIconSrc : item.iconSrc} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TabIconImage({ src }: { src: string }) {
  return (
    <img
      aria-hidden="true"
      alt=""
      className="tab-icon"
      draggable={false}
      src={src}
    />
  );
}
