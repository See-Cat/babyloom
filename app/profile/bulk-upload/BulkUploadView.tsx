'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/mobile/AppShell';
import { UploadButton, type UploadedMedia } from '@/components/media/UploadButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChevronLeftIcon, PlusIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';

export interface BulkUploadViewProps {
  babyId: string;
  babyName: string;
}

export function BulkUploadView({ babyId, babyName }: BulkUploadViewProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<UploadedMedia[]>([]);

  function onUploaded(media: UploadedMedia) {
    setItems((prev) => {
      const i = prev.findIndex((m) => m.mediaId === media.mediaId);
      if (i === -1) return [...prev, media];
      const next = prev.slice();
      next[i] = media;
      return next;
    });
  }

  const readyCount = items.filter((m) => m.status === 'ready').length;
  const pendingCount = items.filter((m) => m.status === 'pending').length;

  return (
    <AppShell
      title="批量补传历史照片"
      align="center"
      hideTabbar
      leftSlot={
        <button
          type="button"
          aria-label="返回"
          onClick={() => router.back()}
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5"
        >
          <ChevronLeftIcon />
        </button>
      }
    >
      <Card className="mb-[var(--space-4)]">
        <p className="m-0 text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
          为 {babyName} 补传历史照片
        </p>
        <p className="mt-[var(--space-2)] text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-fg-soft)]">
          这里上传的照片会直接进入画廊,按拍摄时间归档,但不会出现在时间轴。
          想给某张照片配上一段故事?稍后在画廊点开它,选「为这张照片写一则记录」。
        </p>
      </Card>

      <div className="mb-[var(--space-4)]">
        <UploadButton
          babyId={babyId}
          multiple
          onUploaded={onUploaded}
          renderTrigger={({ click, busy }) => (
            <button
              type="button"
              onClick={click}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-light)] bg-[var(--color-surface-2)] px-[var(--space-5)] py-[var(--space-7)] text-[color:var(--color-fg-soft)] active:bg-[var(--color-surface)] disabled:opacity-50"
            >
              {busy ? <Spinner /> : <PlusIcon className="h-8 w-8" />}
              <span className="text-[length:var(--text-md)] font-bold text-[color:var(--color-fg)]">
                {busy ? '上传中…' : '从相册选择'}
              </span>
              <span className="text-[length:var(--text-xs)]">支持一次选择多张</span>
            </button>
          )}
        />
      </div>

      {items.length > 0 && (
        <Card className="mb-[var(--space-4)]">
          <div className="flex items-baseline justify-between">
            <p className="m-0 text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)]">
              已上传 {readyCount} 张
              {pendingCount > 0 && (
                <span className="ml-[var(--space-2)] font-semibold text-[color:var(--color-fg-soft)]">
                  · {pendingCount} 张处理中
                </span>
              )}
            </p>
          </div>
          <ul className="mt-[var(--space-3)] grid gap-[var(--space-2)]">
            {items.map((m) => (
              <li
                key={m.mediaId}
                className="flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-fg)]"
              >
                <span
                  aria-hidden="true"
                  className={
                    m.status === 'ready'
                      ? 'inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]'
                      : 'inline-block h-2 w-2 rounded-full bg-[var(--color-fg-soft)]'
                  }
                />
                <span className="truncate">{m.filename}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {readyCount > 0 && (
        <div className="sticky bottom-[calc(var(--space-4)+env(safe-area-inset-bottom))] mt-[var(--space-4)]">
          <Link href={`/gallery?babyId=${babyId}`}>
            <Button size="lg" className="w-full">
              去画廊查看({readyCount} 张已加入)
            </Button>
          </Link>
        </div>
      )}
    </AppShell>
  );
}
