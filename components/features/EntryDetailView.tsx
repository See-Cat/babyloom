'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MediaCarousel } from '@/components/media/MediaCarousel';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { AppShell } from '@/components/mobile/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronLeftIcon, DotsIcon } from '@/components/ui/icons';
import { useToast } from '@/lib/hooks/useToast';
import { formatLongDateTime } from '@/lib/format-time';

interface EntryDetailViewProps {
  entry: {
    id: string;
    babyId: string;
    content: string;
    occurredAt: number;
    createdAt?: number | null;
  };
  babyName?: string | null;
  babyBirthday?: string | null;
  authorName?: string | null;
  authorImage?: string | null;
  milestoneNames: string[];
  mediaIds: string[];
  canEdit: boolean;
}

export function EntryDetailView({
  entry,
  babyBirthday,
  authorName,
  authorImage,
  milestoneNames,
  mediaIds,
  canEdit
}: EntryDetailViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [actionOpen, setActionOpen] = React.useState(false);
  const recordedAt = entry.createdAt ?? entry.occurredAt;
  const hasMedia = mediaIds.length > 0;

  async function onTrash() {
    const res = await fetch(`/api/entries/${entry.id}/trash`, { method: 'POST' });
    if (!res.ok) {
      toast.show({ message: '移到回收站失败', variant: 'error' });
      return;
    }
    toast.show({ message: '已移到回收站', variant: 'success' });
    router.push(`/timeline?babyId=${entry.babyId}`);
    router.refresh();
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(entry.content);
      toast.show({ message: '已复制', variant: 'success' });
    } catch {
      toast.show({ message: '复制失败', variant: 'error' });
    }
  }

  const baseBtn =
    'inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] backdrop-blur-[8px] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]';
  const overMedia = 'bg-white/80 text-[color:var(--color-fg-strong)]';
  const overBg = 'bg-[var(--color-surface-2)] text-[color:var(--color-fg)]';

  return (
    <AppShell
      hideHeader={hasMedia}
      leftSlot={
        !hasMedia ? (
          <Link href={`/timeline?babyId=${entry.babyId}`} aria-label="返回时间线" className={`${baseBtn} ${overBg}`}>
            <ChevronLeftIcon />
          </Link>
        ) : undefined
      }
      rightSlot={
        !hasMedia && canEdit ? (
          <button type="button" aria-label="更多操作" onClick={() => setActionOpen(true)} className={`${baseBtn} ${overBg}`}>
            <DotsIcon />
          </button>
        ) : undefined
      }
      className="max-w-2xl px-0"
    >
      {hasMedia && (
        <div className="relative -mx-[var(--space-4)] mb-[var(--space-4)]">
          <MediaCarousel mediaIds={mediaIds} />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] pt-[calc(var(--space-5)+env(safe-area-inset-top))]">
            <Link
              href={`/timeline?babyId=${entry.babyId}`}
              aria-label="返回时间线"
              className={`pointer-events-auto ${baseBtn} ${overMedia}`}
            >
              <ChevronLeftIcon />
            </Link>
            {canEdit && (
              <button
                type="button"
                aria-label="更多操作"
                onClick={() => setActionOpen(true)}
                className={`pointer-events-auto ${baseBtn} ${overMedia}`}
              >
                <DotsIcon />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="px-[var(--space-4)]">
        <div className="mb-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-2)]">
          <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">
            {formatLongDateTime(entry.occurredAt)}
          </p>
          {babyBirthday && (
            <span className="inline-flex rounded-[var(--radius-pill)] bg-[var(--color-primary-bg)] px-[var(--space-2)] py-[2px] text-[length:var(--text-xs)] font-bold text-[color:var(--color-primary-active)]">
              {formatAge(babyBirthday, entry.occurredAt)}
            </span>
          )}
        </div>

        <p className="whitespace-pre-wrap text-[length:var(--text-lg)] font-medium leading-[1.75] text-[color:var(--color-fg)]">
          {entry.content}
        </p>

        {milestoneNames.length > 0 && (
          <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
            {milestoneNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--color-primary-bg)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-primary-active)]"
              >
                ★ {name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-[var(--space-5)] flex items-center gap-[var(--space-3)] border-t border-[var(--color-border-light)] pt-[var(--space-4)]">
          <Avatar
            src={authorImage ?? undefined}
            name={authorName ?? '未知'}
            alt={authorName ?? '未知'}
            size="sm"
          />
          <div>
            <p className="text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)]">{authorName ?? '未知'}</p>
            <p className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">{formatLongDateTime(recordedAt)} 记录</p>
          </div>
        </div>
      </div>

      <ActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        title="记录操作"
        options={[
          { label: '编辑', emphasized: true, onSelect: () => router.push(`/entry/${entry.id}/edit`) },
          { label: '复制内容', onSelect: () => void onCopy() },
          { label: '移到回收站', destructive: true, onSelect: () => void onTrash() }
        ]}
      />
    </AppShell>
  );
}

function formatAge(birthday: string, atMs: number) {
  const birth = new Date(`${birthday}T00:00:00Z`);
  const at = new Date(atMs);
  if (Number.isNaN(birth.getTime())) return '';
  let months = (at.getUTCFullYear() - birth.getUTCFullYear()) * 12 + at.getUTCMonth() - birth.getUTCMonth();
  if (at.getUTCDate() < birth.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years > 0) return `${years}岁${rest}月`;
  return `${rest}个月`;
}
