'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MediaCarousel } from '@/components/media/MediaCarousel';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import type { MediaItem } from '@/lib/server/media/types';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { AppShell } from '@/components/mobile/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronLeftIcon, DotsIcon } from '@/components/ui/icons';
import { useToast } from '@/lib/client/hooks/useToast';
import { useTimezone } from '@/components/system/TimezoneProvider';
import { formatLongDateTime } from '@/lib/shared/format-time';
import { babyAge, formatBabyAgeShort } from '@/lib/shared/baby-age';
import { milestoneTagStyle } from '@/lib/shared/milestone-tint';
import type { AvatarColor } from '@/lib/shared/avatar-colors';

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
  authorAvatarColor?: AvatarColor | null;
  milestoneNames: string[];
  mediaItems: MediaItem[];
  canEdit: boolean;
}

export function EntryDetailView({
  entry,
  babyBirthday,
  authorName,
  authorImage,
  authorAvatarColor,
  milestoneNames,
  mediaItems,
  canEdit
}: EntryDetailViewProps) {
  const router = useRouter();
  const toast = useToast();
  const timeZone = useTimezone();
  const [actionOpen, setActionOpen] = React.useState(false);
  const [lightboxAt, setLightboxAt] = React.useState<number | null>(null);
  const recordedAt = entry.createdAt ?? entry.occurredAt;
  const hasMedia = mediaItems.length > 0;

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

  function onBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/timeline?babyId=${entry.babyId}`);
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
          <button type="button" onClick={onBack} aria-label="返回" className={`${baseBtn} ${overBg}`}>
            <ChevronLeftIcon />
          </button>
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
          <MediaCarousel items={mediaItems} onOpenAt={(i) => setLightboxAt(i)} />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] pt-[calc(var(--space-5)+env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={onBack}
              aria-label="返回"
              className={`pointer-events-auto ${baseBtn} ${overMedia}`}
            >
              <ChevronLeftIcon />
            </button>
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
            {formatLongDateTime(entry.occurredAt, timeZone)}
          </p>
          {babyBirthday && (
            <span className="inline-flex rounded-[var(--radius-pill)] bg-[var(--color-primary-bg)] px-[var(--space-2)] py-[2px] text-[length:var(--text-xs)] font-bold text-[color:var(--color-primary-active)]">
              {formatAge(babyBirthday, entry.occurredAt, timeZone)}
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
                className="inline-flex items-center rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold"
                style={milestoneTagStyle(name)}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-[var(--space-5)] flex items-center gap-[var(--space-3)] border-t border-[var(--color-border-light)] pt-[var(--space-4)]">
          <Avatar
            src={authorImage ?? undefined}
            name={authorName ?? '未知'}
            alt={authorName ?? '未知'}
            color={authorAvatarColor ?? undefined}
            size="sm"
          />
          <div>
            <p className="text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)]">{authorName ?? '未知'}</p>
            <p className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">{formatLongDateTime(recordedAt, timeZone)} 记录</p>
          </div>
        </div>
      </div>

      {lightboxAt !== null && (
        <MediaLightbox items={mediaItems} startIndex={lightboxAt} onClose={() => setLightboxAt(null)} />
      )}

      <ActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        title="记录操作"
        options={[
          { label: '编辑', emphasized: true, onSelect: () => router.push(`/entry/${entry.id}/edit`) },
          { label: '移到回收站', destructive: true, onSelect: () => void onTrash() }
        ]}
      />
    </AppShell>
  );
}

function formatAge(birthday: string, atMs: number, timeZone: string) {
  const age = babyAge(birthday, atMs, timeZone);
  return age ? formatBabyAgeShort(age) : '';
}
