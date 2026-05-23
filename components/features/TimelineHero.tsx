import * as React from 'react';
import Link from 'next/link';
import { MediaImage } from '@/components/media/MediaImage';
import { Button } from '@/components/ui/Button';

export interface TimelineHeroEntry {
  id: string;
  content: string;
  occurredAt: number;
}

export interface TimelineHeroProps {
  babyId: string;
  entry?: TimelineHeroEntry;
  authorName?: string | null;
  mediaIds?: string[];
}

export function TimelineHero({ babyId, entry, authorName = '家人', mediaIds = [] }: TimelineHeroProps) {
  if (!entry) {
    return (
      <section className="bl-timeline-hero rounded-[var(--radius-hero)] border-2 border-dashed border-[var(--color-border-light)] bg-[var(--color-surface-2)] px-[var(--space-5)] py-[var(--space-6)] text-center">
        <p className="text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">今天还没有记录</p>
        <p className="mt-[var(--space-1)] text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">写下一个小瞬间,以后会很珍贵。</p>
        <Link href={`/entry/new?babyId=${babyId}`} className="mt-[var(--space-4)] inline-flex">
          <Button type="button" size="sm">现在写</Button>
        </Link>
      </section>
    );
  }

  const hasMedia = mediaIds.length > 0;

  if (hasMedia) {
    return (
      <Link href={`/entry/${entry.id}`} className="bl-timeline-hero group relative block h-[200px] overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-surface)]">
        <MediaImage mediaId={mediaIds[0]} size="large" alt={entry.content.slice(0, 24) || '时光照片'} className="h-full w-full object-cover motion-safe:animate-[hero-drift_var(--duration-ambient)_ease-in-out_infinite_alternate]" />
        <span className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--color-media-scrim)] to-transparent" aria-hidden="true" />
        {mediaIds.length > 1 && (
          <span className="absolute right-[var(--space-3)] top-[var(--space-3)] rounded-[var(--radius-sm)] bg-[var(--color-media-badge)] px-[10px] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)]">
            {mediaIds.length} 张
          </span>
        )}
        <HeroText entry={entry} authorName={authorName} inverse />
      </Link>
    );
  }

  return (
    <Link href={`/entry/${entry.id}`} className="bl-timeline-hero block rounded-[var(--radius-hero)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-5)]">
      <p className="line-clamp-3 whitespace-pre-wrap text-[length:var(--text-md)] font-bold leading-[var(--leading-base)] text-[color:var(--color-fg-strong)]">{entry.content}</p>
      <p className="mt-[var(--space-3)] text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
        {authorName} · {formatTime(entry.occurredAt)}
      </p>
    </Link>
  );
}

function HeroText({ entry, authorName, inverse = false }: { entry: TimelineHeroEntry; authorName: string | null; inverse?: boolean }) {
  return (
    <span className="absolute inset-x-0 bottom-0 z-10 block p-[var(--space-5)]">
      <span className={inverse ? 'line-clamp-2 text-[length:var(--text-md)] font-bold leading-[var(--leading-base)] text-[color:var(--color-fg-inverse)]' : 'line-clamp-2 text-[length:var(--text-md)] font-bold leading-[var(--leading-base)] text-[color:var(--color-fg-strong)]'}>
        {entry.content}
      </span>
      <span className={inverse ? 'mt-[var(--space-1)] block text-[length:var(--text-xs)] font-semibold text-white/85' : 'mt-[var(--space-1)] block text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]'}>
        {authorName} · {formatTime(entry.occurredAt)}
      </span>
    </span>
  );
}

function formatTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
