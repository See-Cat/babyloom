'use client';

import * as React from 'react';
import { MediaImage } from './MediaImage';

export function Gallery({ mediaIds }: { mediaIds: string[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  if (mediaIds.length === 0) return null;

  return (
    <>
      <ul className="gallery mt-4 grid grid-cols-3 gap-2">
        {mediaIds.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setOpen(id)}
              className="aspect-square w-full overflow-hidden rounded border bg-neutral-50"
            >
              <MediaImage mediaId={id} size="thumb" alt="" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="gallery__lightbox fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(null)}
        >
          <MediaImage mediaId={open} size="large" alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}
