'use client';

import * as React from 'react';
import Link from 'next/link';
import { MediaImage } from '@/components/media/MediaImage';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { Button } from '@/components/ui/Button';
import { CameraIcon } from '@/components/ui/icons';
import { useTimezone } from '@/components/system/TimezoneProvider';
import { formatRelativeDateTime } from '@/lib/shared/format-time';
import type { MediaItem } from '@/lib/server/media/types';

export interface TimelineHeroEntry {
  id: string;
  content: string;
  occurredAt: number;
}

export interface TimelineHeroProps {
  babyId: string;
  entry?: TimelineHeroEntry;
  authorName?: string | null;
  mediaItems?: MediaItem[];
  canWrite?: boolean;
  /** @deprecated use mediaItems */
  mediaIds?: string[];
}

export function TimelineHero({ babyId, entry, authorName = '家人', mediaItems, mediaIds, canWrite = true }: TimelineHeroProps) {
  const items: MediaItem[] = mediaItems ?? (mediaIds ?? []).map((id) => ({ id, type: 'photo' }));
  const timeZone = useTimezone();
  const [lightboxAt, setLightboxAt] = React.useState<number | null>(null);

  if (!entry) {
    return (
      <section className="bl-timeline-hero bl-rise-hero rounded-[var(--radius-hero)] border-2 border-dashed border-[var(--color-border-light)] bg-[var(--color-surface-2)] px-[var(--space-5)] py-[var(--space-6)] text-center">
        <p className="text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">今天还没有记录</p>
        <p className="mt-[var(--space-1)] text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">写下一个小瞬间,以后会很珍贵。</p>
        {canWrite && (
          <Link href={`/entry/new?babyId=${babyId}`} className="mt-[var(--space-4)] inline-flex">
            <Button type="button" size="sm">现在写</Button>
          </Link>
        )}
      </section>
    );
  }

  const hasMedia = items.length > 0;

  if (hasMedia) {
    const first = items[0];
    return (
      <section className="bl-timeline-hero bl-rise-hero group relative block h-[200px] overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-surface)]">
        <button
          type="button"
          aria-label={first.type === 'video' ? '查看视频' : '查看图片'}
          onClick={() => setLightboxAt(0)}
          className="absolute inset-0 block h-full w-full"
        >
          <MediaImage
            mediaId={first.id}
            size="large"
            alt={entry.content.slice(0, 24) || '时光照片'}
            className="h-full w-full object-cover motion-safe:animate-[hero-drift_var(--duration-ambient)_ease-in-out_infinite_alternate]"
          />
          {first.type === 'video' && (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-black/15 text-[length:var(--text-xl)] text-white drop-shadow"
            >
              ▶
            </span>
          )}
        </button>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--color-media-scrim)] to-transparent" aria-hidden="true" />
        {items.length > 1 && (
          <span className="pointer-events-none absolute right-[var(--space-3)] top-[var(--space-3)] z-10 inline-flex items-center gap-[6px] rounded-[var(--radius-pill)] bg-[var(--color-media-badge)] px-[10px] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)] backdrop-blur-[6px]">
            <CameraIcon className="h-3.5 w-3.5" /> {items.length}
          </span>
        )}
        <Link
          href={`/entry/${entry.id}`}
          className="absolute inset-x-0 bottom-0 z-10 block p-[var(--space-5)]"
        >
          <span className="line-clamp-2 block text-[length:var(--text-md)] font-bold leading-[var(--leading-base)] text-[color:var(--color-fg-inverse)]">
            {entry.content || '查看记录'}
          </span>
          <span className="mt-[var(--space-1)] block text-[length:var(--text-xs)] font-semibold text-white/85">
            {authorName} · {formatRelativeDateTime(entry.occurredAt, timeZone)}
          </span>
        </Link>
        {lightboxAt !== null && (
          <MediaLightbox items={items} startIndex={lightboxAt} onClose={() => setLightboxAt(null)} />
        )}
      </section>
    );
  }

  return (
    <Link href={`/entry/${entry.id}`} className="bl-timeline-hero bl-rise-hero block rounded-[var(--radius-hero)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-5)]">
      <p className="line-clamp-3 whitespace-pre-wrap text-[length:var(--text-md)] font-bold leading-[var(--leading-base)] text-[color:var(--color-fg-strong)]">{entry.content}</p>
      <p className="mt-[var(--space-3)] text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
        {authorName} · {formatRelativeDateTime(entry.occurredAt, timeZone)}
      </p>
    </Link>
  );
}
