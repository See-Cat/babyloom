'use client';

import * as React from 'react';
import { MediaImage } from './MediaImage';
import { cn } from '@/lib/cn';

export function MediaCarousel({ mediaIds }: { mediaIds: string[] }) {
  const [index, setIndex] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  if (mediaIds.length === 0) return null;

  function onScroll() {
    const node = ref.current;
    if (!node) return;
    const w = node.clientWidth;
    if (w === 0) return;
    const next = Math.round(node.scrollLeft / w);
    if (next !== index) setIndex(next);
  }

  return (
    <div className="relative w-full">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto bg-[var(--color-surface)]"
        style={{ scrollbarWidth: 'none' }}
      >
        {mediaIds.map((id) => (
          <div key={id} className="relative aspect-square w-full shrink-0 snap-center">
            <MediaImage mediaId={id} size="large" alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {mediaIds.length > 1 && (
        <>
          <span className="pointer-events-none absolute left-1/2 top-[calc(var(--space-5)+env(safe-area-inset-top))] z-20 -translate-x-1/2 rounded-[var(--radius-pill)] bg-[var(--color-media-badge)] px-[10px] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-inverse)] backdrop-blur-[6px]">
            {index + 1} / {mediaIds.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-[var(--space-3)] flex justify-center gap-[6px]">
            {mediaIds.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  'h-[6px] rounded-full transition-all',
                  i === index ? 'w-5 bg-white' : 'w-[6px] bg-white/55'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
