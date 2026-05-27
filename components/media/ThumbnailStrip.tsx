'use client';

import { MediaImage } from './MediaImage';
import type { MediaItem } from '@/lib/media/types';

export interface ThumbnailStripProps {
  items: MediaItem[];
  onOpenAt?: (index: number) => void;
}

export function ThumbnailStrip({ items, onOpenAt }: ThumbnailStripProps) {
  if (items.length === 0) return null;

  return (
    <ul className="thumbnail-strip mt-[var(--space-3)] flex gap-[var(--space-2)] overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        >
          {onOpenAt ? (
            <button
              type="button"
              aria-label={item.type === 'video' ? '查看视频' : '查看图片'}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenAt(i);
              }}
              className="block h-full w-full"
            >
              <ThumbContent item={item} />
            </button>
          ) : (
            <ThumbContent item={item} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ThumbContent({ item }: { item: MediaItem }) {
  return (
    <>
      <MediaImage
        mediaId={item.id}
        size="thumb"
        alt=""
        width={64}
        height={64}
        className="h-full w-full object-cover"
      />
      {item.type === 'video' && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-black/20 text-[length:var(--text-md)] text-white drop-shadow"
        >
          ▶
        </span>
      )}
    </>
  );
}
