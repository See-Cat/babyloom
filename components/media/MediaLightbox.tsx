'use client';

import * as React from 'react';
import { MediaImage } from './MediaImage';
import type { MediaItem } from '@/lib/media/types';
import { ChevronLeftIcon, XIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface MediaLightboxProps {
  items: MediaItem[];
  startIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ items, startIndex, onClose }: MediaLightboxProps) {
  const [index, setIndex] = React.useState(startIndex);
  const total = items.length;
  const current = items[index];
  const stripRef = React.useRef<HTMLDivElement>(null);

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
      <div className="flex flex-1 items-center justify-center px-[var(--space-2)]">
        {current.type === 'video' ? (
          <video
            key={current.id}
            src={`/api/media/${current.id}?size=original`}
            poster={`/api/media/${current.id}?size=poster`}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
          />
        ) : (
          <MediaImage
            mediaId={current.id}
            size="large"
            alt={current.filename || ''}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
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
