'use client';

import * as React from 'react';
import { MediaImage } from './MediaImage';
import type { MediaItem } from '@/lib/server/media/types';
import { ChevronLeftIcon, XIcon } from '@/components/ui/icons';
import { cn } from '@/lib/shared/cn';

export interface MediaLightboxProps {
  items: MediaItem[];
  startIndex: number;
  onClose: () => void;
  /** Optional content rendered between the pager and the thumbnail strip (e.g. CTA links). */
  renderFooter?: (current: MediaItem, index: number) => React.ReactNode;
}

export function MediaLightbox({ items, startIndex, onClose, renderFooter }: MediaLightboxProps) {
  const [index, setIndex] = React.useState(startIndex);
  const total = items.length;
  const current = items[index];
  const stripRef = React.useRef<HTMLDivElement>(null);
  const pagerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, total]);

  React.useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLButtonElement>(`button[data-strip-index="${index}"]`);
    node?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  // Sync pager scroll position only when index changed via keyboard / thumbnail.
  // Swipe-driven index changes must NOT re-scroll, or the programmatic scrollTo
  // interrupts the browser's native snap settle and the image visibly jitters.
  const didInitRef = React.useRef(false);
  const fromScrollRef = React.useRef(false);
  React.useLayoutEffect(() => {
    if (fromScrollRef.current) {
      fromScrollRef.current = false;
      didInitRef.current = true;
      return;
    }
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
    if (next !== index && next >= 0 && next < total) {
      fromScrollRef.current = true;
      setIndex(next);
    }
  }

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="媒体查看器"
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-black/95"
    >
      <header className="flex items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] pb-[var(--space-3)] pt-[calc(var(--space-3)+env(safe-area-inset-top))] backdrop-blur-[8px]">
        <button
          type="button"
          aria-label="返回"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-white/10 text-white"
        >
          <ChevronLeftIcon />
        </button>
        {total > 1 && (
          <span className="text-[length:var(--text-sm)] font-semibold text-white/85">
            {index + 1} / {total}
          </span>
        )}
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
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-[var(--space-2)]"
          >
            {item.type === 'video' ? (
              <video
                src={`/api/media/${item.id}?size=original`}
                poster={`/api/media/${item.id}?size=poster`}
                controls={i === index}
                playsInline
                preload={i === index ? 'metadata' : 'none'}
                className="max-h-full max-w-full"
              />
            ) : (
              <MediaImage
                mediaId={item.id}
                size="large"
                alt={item.filename || ''}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>
      {renderFooter && (
        <div className="px-[var(--space-4)] pb-[var(--space-2)]">{renderFooter(current, index)}</div>
      )}
      {total > 1 && (
        <div
          ref={stripRef}
          className="flex gap-[var(--space-1)] overflow-x-auto px-[var(--space-3)] py-[var(--space-3)]"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              data-strip-index={i}
              onClick={() => setIndex(i)}
              className={cn(
                'relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] ring-2 transition',
                i === index ? 'ring-white' : 'ring-transparent opacity-60'
              )}
            >
              <MediaImage mediaId={item.id} size="thumb" alt="" className="h-full w-full object-cover" />
              {item.type === 'video' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center text-white drop-shadow"
                >
                  ▶
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
