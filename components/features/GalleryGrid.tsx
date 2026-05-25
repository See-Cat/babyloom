'use client';

import * as React from 'react';
import Link from 'next/link';
import { MediaImage } from '@/components/media/MediaImage';
import { Button } from '@/components/ui/Button';
import { ChevronLeftIcon, PlusIcon, XIcon } from '@/components/ui/icons';
import type { GalleryMonthGroup, GalleryMedia } from '@/lib/db/queries/gallery';
import { cn } from '@/lib/cn';

export function GalleryGrid({ babyId, groups }: { babyId: string; groups: Array<GalleryMonthGroup<GalleryMedia>> }) {
  const flatItems = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);

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
        <Viewer
          babyId={babyId}
          items={flatItems}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </>
  );
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

function Viewer({
  babyId,
  items,
  index,
  onClose,
  onIndexChange
}: {
  babyId: string;
  items: GalleryMedia[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const current = items[index];
  const total = items.length;
  const stripRef = React.useRef<HTMLDivElement>(null);
  const pagerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, index - 1));
      else if (e.key === 'ArrowRight') onIndexChange(Math.min(total - 1, index + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose, onIndexChange, total]);

  React.useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLButtonElement>(`button[data-strip-index="${index}"]`);
    node?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  // Sync pager scroll position when index changes via keyboard / thumbnail click.
  // First mount jumps instantly to the opened index; later changes animate.
  const didInitRef = React.useRef(false);
  React.useLayoutEffect(() => {
    const node = pagerRef.current;
    if (!node) return;
    const target = index * node.clientWidth;
    if (Math.abs(node.scrollLeft - target) > 1) {
      node.scrollTo({ left: target, behavior: didInitRef.current ? 'smooth' : 'auto' });
    }
    didInitRef.current = true;
  }, [index]);

  function onPagerScroll() {
    const node = pagerRef.current;
    if (!node || node.clientWidth === 0) return;
    const next = Math.round(node.scrollLeft / node.clientWidth);
    if (next !== index && next >= 0 && next < total) onIndexChange(next);
  }

  if (!current) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="照片查看器" className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-black/95">
      <header className="flex items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] pb-[var(--space-3)] pt-[calc(var(--space-3)+env(safe-area-inset-top))] backdrop-blur-[8px]">
        <button
          type="button"
          aria-label="返回"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-white/10 text-white"
        >
          <ChevronLeftIcon />
        </button>
        <span className="text-[length:var(--text-sm)] font-semibold text-white/85">{index + 1} / {total}</span>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-white/10 text-white"
        >
          <XIcon />
        </button>
      </header>
      <div
        ref={pagerRef}
        onScroll={onPagerScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-[var(--space-2)]"
          >
            <MediaImage
              mediaId={item.id}
              size="large"
              alt={item.filename || ''}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>
      <div className="px-[var(--space-4)] pb-[var(--space-2)]">
        {current.entryId === null ? (
          <Link
            href={buildComposerHref(babyId, current)}
            className="flex w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-white/12 px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-bold text-white backdrop-blur-[8px] active:bg-white/20"
          >
            <PlusIcon className="h-4 w-4" />
            为这张照片写一则记录
          </Link>
        ) : (
          <Link
            href={`/entry/${current.entryId}`}
            className="flex w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-white/12 px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-sm)] font-bold text-white backdrop-blur-[8px] active:bg-white/20"
          >
            查看这条记录
          </Link>
        )}
      </div>
      <div ref={stripRef} className="flex gap-[var(--space-1)] overflow-x-auto px-[var(--space-3)] py-[var(--space-3)]" style={{ scrollbarWidth: 'none' }}>
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            data-strip-index={i}
            onClick={() => onIndexChange(i)}
            className={cn(
              'h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] ring-2 transition',
              i === index ? 'ring-white' : 'ring-transparent opacity-60'
            )}
          >
            <MediaImage mediaId={item.id} size="thumb" alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
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
