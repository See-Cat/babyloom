'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThumbnailStrip } from '@/components/media/ThumbnailStrip';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { useTimezone, useRenderNow } from '@/components/system/TimezoneProvider';
import { formatRelativeDateTime } from '@/lib/shared/format-time';
import type { MediaItem } from '@/lib/server/media/types';
import { milestoneTagStyle } from '@/lib/shared/milestone-tint';
import type { AvatarColor } from '@/lib/shared/avatar-colors';

export interface TimelineCardProps {
  entry: {
    id: string;
    content: string;
    occurredAt: number;
  };
  authorName?: string | null;
  authorImage?: string | null;
  authorAvatarColor?: AvatarColor | null;
  mediaItems?: MediaItem[];
  milestoneNames?: string[];
  animationDelayMs?: number;
}

export function TimelineCard({
  entry,
  authorName = '未知',
  authorImage,
  authorAvatarColor,
  mediaItems = [],
  milestoneNames = [],
  animationDelayMs
}: TimelineCardProps) {
  const router = useRouter();
  const timeZone = useTimezone();
  const renderNow = useRenderNow();
  const [lightboxAt, setLightboxAt] = React.useState<number | null>(null);
  const href = `/entry/${entry.id}`;

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button')) return;
    router.push(href);
  };

  return (
    <Card
      as="article"
      interactive
      className="bl-rise-card cursor-pointer"
      style={typeof animationDelayMs === 'number' ? { animationDelay: `${animationDelayMs}ms` } : undefined}
      onClick={handleCardClick}
    >
      <Link href={href} className="block">
        <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
          <Avatar
            src={authorImage ?? undefined}
            name={authorName ?? '未知'}
            alt={authorName ?? '未知'}
            color={authorAvatarColor ?? undefined}
            size="sm"
          />
          <div>
            <p className="text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)]">{authorName}</p>
            <p className="text-[length:var(--text-xs)] text-[color:var(--color-muted)]">
              {formatRelativeDateTime(entry.occurredAt, timeZone, renderNow || undefined)}
            </p>
          </div>
        </div>
        {entry.content && <p className="line-clamp-3 whitespace-pre-wrap">{entry.content}</p>}
      </Link>
      {milestoneNames.length > 0 && (
        <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
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
      <ThumbnailStrip items={mediaItems} onOpenAt={(i) => setLightboxAt(i)} />
      {lightboxAt !== null && (
        <MediaLightbox items={mediaItems} startIndex={lightboxAt} onClose={() => setLightboxAt(null)} />
      )}
    </Card>
  );
}
