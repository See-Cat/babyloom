'use client';

import { MediaImage } from '@/components/media/MediaImage';
import { UploadButton, type UploadedMedia } from '@/components/media/UploadButton';
import { XIcon, PlusIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';

export interface MediaUploaderProps {
  babyId: string;
  uploadedMedia: UploadedMedia[];
  disabled?: boolean;
  onUploaded: (media: UploadedMedia) => void;
  onRemove: (mediaId: string) => void;
}

export function MediaUploader({ babyId, disabled, onRemove, onUploaded, uploadedMedia }: MediaUploaderProps) {
  const readyCount = uploadedMedia.filter((m) => m.status === 'ready').length;

  return (
    <div>
      <p className="mb-[var(--space-2)] px-[var(--space-1)] text-[length:var(--text-xs)] font-bold uppercase tracking-[0.5px] text-[color:var(--color-fg-soft)]">
        媒体{readyCount > 0 && ` · 已上传 ${readyCount} 张`}
      </p>
      <ul className="grid grid-cols-3 gap-[var(--space-2)]">
        {uploadedMedia.map((media) => (
          <li key={media.mediaId} className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
            {media.status === 'ready' ? (
              <>
                <MediaImage
                  mediaId={media.mediaId}
                  size="thumb"
                  alt={media.filename}
                  width={200}
                  height={200}
                  className="h-full w-full object-cover"
                />
                {media.type === 'video' && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 text-[length:var(--text-lg)] text-white drop-shadow"
                  >
                    ▶
                  </span>
                )}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Spinner />
                <span className="absolute bottom-2 left-2 right-2 h-1 overflow-hidden rounded-full bg-white/50">
                  <span className="block h-full w-3/5 bg-[var(--color-primary)]" />
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(media.mediaId)}
              aria-label="移除"
              className="absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-black/50 text-white"
              style={{ width: 22, height: 22 }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        <li className="aspect-square">
          <UploadButton
            babyId={babyId}
            onUploaded={onUploaded}
            disabled={disabled}
            renderTrigger={({ click, busy }) => (
              <button
                type="button"
                onClick={click}
                disabled={disabled || busy}
                aria-label="添加照片或视频"
                className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--color-border-light)] bg-[var(--color-surface-2)] text-[color:var(--color-fg-soft)] active:bg-[var(--color-surface)] disabled:opacity-50"
              >
                {busy ? <Spinner /> : <PlusIcon className="h-7 w-7" />}
                <span className="text-[length:var(--text-xs)] font-bold">添加</span>
              </button>
            )}
          />
        </li>
      </ul>
    </div>
  );
}
