'use client';

import * as React from 'react';
import Link from 'next/link';
import { ThumbnailStrip } from '@/components/media/ThumbnailStrip';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { formatRelativeDateTime } from '@/lib/format-time';
import type { MediaItem } from '@/lib/media/types';

export interface TimelineCardProps {
  entry: {
    id: string;
    content: string;
    occurredAt: number;
  };
  authorName?: string | null;
  authorImage?: string | null;
  mediaItems?: MediaItem[];
  animationDelayMs?: number;
}

export function TimelineCard({
  entry,
  authorName = '未知',
  authorImage,
  mediaItems = [],
  animationDelayMs
}: TimelineCardProps) {
  const [lightboxAt, setLightboxAt] = React.useState<number | null>(null);

  return (
    <Card
      as="article"
      interactive
      className="bl-rise-card"
      style={typeof animationDelayMs === 'number' ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <Link href={`/entry/${entry.id}`} className="block">
        <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
          <Avatar
            src={authorImage ?? undefined}
            name={authorName ?? '未知'}
            alt={authorName ?? '未知'}
            size="sm"
          />
          <div>
            <p className="text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)]">{authorName}</p>
            <p className="text-[length:var(--text-xs)] text-[color:var(--color-muted)]">
              {formatRelativeDateTime(entry.occurredAt)}
            </p>
          </div>
        </div>
        {entry.content && <p className="line-clamp-3 whitespace-pre-wrap">{entry.content}</p>}
      </Link>
      <ThumbnailStrip items={mediaItems} onOpenAt={(i) => setLightboxAt(i)} />
      {lightboxAt !== null && (
        <MediaLightbox items={mediaItems} startIndex={lightboxAt} onClose={() => setLightboxAt(null)} />
      )}
    </Card>
  );
}
