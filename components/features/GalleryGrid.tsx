import * as React from 'react';
import Link from 'next/link';
import { MediaImage } from '@/components/media/MediaImage';
import { Button } from '@/components/ui/Button';
import type { GalleryMonthGroup, GalleryMedia } from '@/lib/db/queries/gallery';

export function GalleryGrid({ groups }: { groups: Array<GalleryMonthGroup<GalleryMedia>> }) {
  if (groups.length === 0) {
    return (
      <div className="flex min-h-[52vh] flex-col items-center justify-center gap-[var(--space-2)] px-[var(--space-7)] text-center">
        <div className="mb-[var(--space-2)] text-[var(--space-8)]" aria-hidden="true">
          📸
        </div>
        <p className="m-0 text-[var(--text-lg)] font-bold text-[var(--color-fg-strong)]">还没有照片</p>
        <p className="m-0 mb-[var(--space-3)] text-[var(--text-base)] font-medium leading-[var(--leading-base)] text-[var(--color-fg-soft)]">
          在记录里上传图片或视频,这里就会出现
        </p>
        <Link href="/entry/new">
          <Button size="lg">＋ 新建一条记录</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-[var(--space-5)]">
      {groups.map((group) => (
        <section key={group.ym} aria-labelledby={`gallery-${group.ym}`}>
          <div className="sticky top-0 z-[var(--z-sticky)] flex items-baseline gap-[var(--space-2)] bg-[var(--color-bg)] px-[var(--space-1)] pb-[var(--space-2)] pt-[var(--space-3)]">
            <h2 id={`gallery-${group.ym}`} className="text-[var(--text-md)] font-bold text-[var(--color-fg-strong)]">
              {group.label}
            </h2>
            <span className="text-[var(--text-xs)] font-bold text-[var(--color-fg-soft)]">
              {group.items.length} 张
            </span>
          </div>
          <div className="grid grid-cols-3 gap-[var(--space-1)]">
            {group.items.map((item) => (
              <GalleryTile key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GalleryTile({ item }: { item: GalleryMedia }) {
  const href = item.entryId ? `/entry/${item.entryId}` : `/api/media/${item.id}?size=large`;
  const isBare = !item.entryId;
  const label = item.filename || '宝宝照片';

  const content = (
    <span className="relative block aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)] active:scale-[.97] active:transition-transform active:duration-[var(--duration-press-up)]">
      <MediaImage
        mediaId={item.id}
        alt={label}
        width={item.width ?? 240}
        height={item.height ?? 240}
        className="h-full w-full object-cover"
      />
      {item.type === 'video' && (
        <span className="absolute bottom-1 right-1 rounded-[var(--radius-pill)] bg-[var(--color-media-badge)] px-2 py-1 text-[var(--text-xs)] font-bold text-[var(--color-fg-inverse)]">
          ▶ {formatDuration(item.durationSec)}
        </span>
      )}
    </span>
  );

  return isBare ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {content}
    </a>
  ) : (
    <Link href={href} aria-label={label}>
      {content}
    </Link>
  );
}

function formatDuration(seconds: number | null) {
  const total = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
