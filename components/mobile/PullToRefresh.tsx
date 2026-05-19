'use client';

import * as React from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
}

export function PullToRefresh({ children, className, onRefresh }: PullToRefreshProps) {
  const startY = React.useRef(0);
  const [distance, setDistance] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!('ontouchstart' in window)) return;
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setDistance(0);
    }
  }

  return (
    <div
      className={cn('bl-pull-to-refresh overscroll-contain', className)}
      onTouchStart={(event) => {
        if (window.scrollY === 0) startY.current = event.touches[0].clientY;
      }}
      onTouchMove={(event) => {
        if (window.scrollY > 0) return;
        setDistance(Math.max(0, Math.min(80, event.touches[0].clientY - startY.current)));
      }}
      onTouchEnd={() => {
        if (distance > 56) {
          void refresh();
        } else {
          setDistance(0);
        }
      }}
    >
      <div className="flex justify-center overflow-hidden transition-[height] duration-[var(--duration-fast)] motion-reduce:transition-none" style={{ height: refreshing || distance > 0 ? 40 : 0 }}>
        {(refreshing || distance > 0) && <Spinner />}
      </div>
      {children}
    </div>
  );
}
