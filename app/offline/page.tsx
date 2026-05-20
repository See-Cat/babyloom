import { Card } from '@/components/ui/Card';
import { OfflineRetryButton } from './retry-button';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-[var(--space-4)] text-[var(--color-fg)]">
      <Card className="max-w-sm text-center">
        <h1 className="text-[var(--text-xl)] font-bold text-[var(--color-fg-strong)]">无法连接到家庭服务器</h1>
        <p className="mt-[var(--space-3)] text-[var(--text-sm)] text-[var(--color-muted)]">
          当前只能查看已经缓存的内容。网络恢复后可以继续新增和编辑。
        </p>
        <OfflineRetryButton />
      </Card>
    </main>
  );
}
