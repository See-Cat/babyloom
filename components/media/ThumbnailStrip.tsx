'use client';

import { MediaImage } from './MediaImage';
import type { MediaItem } from '@/lib/media/types';

export interface ThumbnailStripProps {
  items: MediaItem[];
  onOpenAt?: (index: number) => void;
}

export function ThumbnailStrip({ items, onOpenAt }: ThumbnailStripProps) {
  if (items.length === 0) return null;
  const visible = items.slice(0, 4);
  const overflow = items.length - visible.length;

  return (
    <ul className="thumbnail-strip mt-[var(--space-3)] flex gap-[var(--space-2)]">
      {visible.map((item, i) => (
        <li
          key={item.id}
          className="relative h-16 w-16 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]"
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
      {overflow > 0 && (
        <li className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[length:var(--text-sm)]">
          +{overflow}
        </li>
      )}
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
