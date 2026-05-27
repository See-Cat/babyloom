'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MediaImage } from '@/components/media/MediaImage';
import { MediaLightbox } from '@/components/media/MediaLightbox';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/ui/icons';
import type { GalleryMonthGroup, GalleryMedia } from '@/lib/db/queries/gallery';
import type { MediaItem } from '@/lib/media/types';

export function GalleryGrid({ babyId, groups }: { babyId: string; groups: Array<GalleryMonthGroup<GalleryMedia>> }) {
  const router = useRouter();
  const flatItems = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function deleteMedia(media: GalleryMedia) {
    if (deletingId) return;
    setDeletingId(media.id);
    try {
      const res = await fetch(`/api/media/${media.id}/trash`, { method: 'POST' });
      if (!res.ok) throw new Error('trash failed');
      setViewerIndex(null);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[52vh] flex-col items-center justify-center gap-[var(--space-2)] px-[var(--space-7)] text-center">
        <div className="mb-[var(--space-2)] text-[48px] leading-none" aria-hidden="true">📸</div>
        <p className="m-0 text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">还没有照片</p>
        <p className="m-0 mb-[var(--space-3)] text-[length:var(--text-base)] font-medium leading-[var(--leading-base)] text-[color:var(--color-fg-soft)]">
          在记录里上传图片或视频,这里就会出现
        </p>
        <Link href={`/entry/new?babyId=${babyId}`}>
          <Button size="lg" leadingIcon={<PlusIcon />}>新建一条记录</Button>
        </Link>
      </div>
    );
  }

  function openViewer(item: GalleryMedia) {
    const idx = flatItems.findIndex((m) => m.id === item.id);
    setViewerIndex(idx >= 0 ? idx : 0);
  }

  return (
    <>
      <div className="grid gap-[var(--space-5)]">
        {groups.map((group) => (
          <section key={group.ym} aria-labelledby={`gallery-${group.ym}`}>
            <div className="sticky top-0 z-[var(--z-sticky)] flex items-baseline gap-[var(--space-2)] bg-[var(--color-bg)] px-[var(--space-1)] pb-[var(--space-2)] pt-[var(--space-3)]">
              <h2 id={`gallery-${group.ym}`} className="text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
                {group.label}
              </h2>
              <span className="text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-soft)]">
                {group.items.length} 张
              </span>
            </div>
            <div className="grid grid-cols-3 gap-[var(--space-1)]">
              {group.items.map((item) => (
                <GalleryTile key={item.id} item={item} onOpenViewer={openViewer} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {viewerIndex !== null && (
        <MediaLightbox
          items={flatItems.map(toMediaItem)}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          renderFooter={(_item, i) => {
            const media = flatItems[i];
            if (!media) return null;
            return media.entryId === null ? (
              <div className="flex w-full items-center gap-[var(--space-2)]">
                <Link
                  href={buildComposerHref(babyId, media)}
                  className="flex flex-1 items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-white/12 px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-bold text-white backdrop-blur-[8px] active:bg-white/20"
                >
                  <PlusIcon className="h-4 w-4" />
                  为这张照片写一则记录
                </Link>
                <button
                  type="button"
                  onClick={() => deleteMedia(media)}
                  disabled={deletingId === media.id}
                  aria-label="删除照片"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-white/12 text-white backdrop-blur-[8px] active:bg-white/20 disabled:opacity-50"
                >
                  <TrashGlyph />
                </button>
              </div>
            ) : (
              <Link
                href={`/entry/${media.entryId}`}
                className="flex w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-white/12 px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-bold text-white backdrop-blur-[8px] active:bg-white/20"
              >
                查看这条记录
              </Link>
            );
          }}
        />
      )}
    </>
  );
}

function TrashGlyph() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function toMediaItem(m: GalleryMedia): MediaItem {
  return {
    id: m.id,
    type: m.type === 'video' ? 'video' : 'photo',
    durationSec: m.durationSec ?? null,
    filename: m.filename
  };
}

function GalleryTile({ item, onOpenViewer }: { item: GalleryMedia; onOpenViewer: (item: GalleryMedia) => void }) {
  const label = item.filename || '宝宝照片';
  return (
    <button type="button" aria-label={label} onClick={() => onOpenViewer(item)} className="block w-full">
      <span className="relative block aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)] active:scale-[.97] active:transition-transform active:duration-[var(--duration-press-up)]">
        <MediaImage
          mediaId={item.id}
          alt={label}
          width={item.width ?? 240}
          height={item.height ?? 240}
          className="h-full w-full object-cover"
        />
        {item.type === 'video' && (
          <span className="absolute bottom-1 right-1 rounded-[var(--radius-pill)] bg-[var(--color-media-badge)] px-2 py-1 text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)] backdrop-blur-[4px]">
            ▶ {formatDuration(item.durationSec)}
          </span>
        )}
      </span>
    </button>
  );
}

function buildComposerHref(babyId: string, m: GalleryMedia): string {
  const params = new URLSearchParams({
    babyId,
    mediaId: m.id,
    mediaType: m.type === 'video' ? 'video' : 'photo',
    occurredAt: String(m.takenAt ?? m.createdAt)
  });
  if (m.filename) params.set('filename', m.filename);
  return `/entry/new?${params.toString()}`;
}

function formatDuration(seconds: number | null) {
  const total = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
