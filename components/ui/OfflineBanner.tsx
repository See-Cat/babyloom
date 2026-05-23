'use client';

import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';

export function OfflineBanner() {
  const online = useNetworkStatus();
  if (online) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[var(--z-toast)] bg-[var(--color-warning)] px-[var(--space-4)] py-[var(--space-2)] text-center text-[length:var(--text-sm)] font-bold text-[color:var(--color-on-solid)]">
      离线模式 · 显示缓存内容
    </div>
  );
}
