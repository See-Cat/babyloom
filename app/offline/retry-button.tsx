'use client';

import { Button } from '@/components/ui/Button';

export function OfflineRetryButton() {
  return (
    <Button type="button" className="mt-[var(--space-4)]" onClick={() => window.location.reload()}>
      重试
    </Button>
  );
}
