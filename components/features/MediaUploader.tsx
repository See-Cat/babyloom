'use client';

import { MediaImage } from '@/components/media/MediaImage';
import { UploadButton, cancelUpload, type UploadedMedia } from '@/components/media/UploadButton';
import { XIcon, PlusIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';

export interface MediaUploaderProps {
  babyId: string;
  uploadedMedia: UploadedMedia[];
  disabled?: boolean;
  onUploaded: (media: UploadedMedia) => void;
  onRemove: (uploadId: string) => void;
}

export function MediaUploader({ babyId, disabled, onRemove, onUploaded, uploadedMedia }: MediaUploaderProps) {
  const readyCount = uploadedMedia.filter((m) => m.status === 'ready').length;

  // Removable: settled items (ready/failed) and still-queued uploads (cancellable
  // before a request is sent). Not removable: items mid-upload/processing.
  function isRemovable(media: UploadedMedia): boolean {
    if (media.status === 'ready' || media.status === 'failed') return true;
    return media.status === 'pending' && media.phase === 'queued';
  }

  function handleRemove(media: UploadedMedia): void {
    if (media.status === 'pending' && media.phase === 'queued') cancelUpload(media.uploadId);
    onRemove(media.uploadId);
  }

  return (
    <div>
      <p className="mb-[var(--space-2)] px-[var(--space-1)] text-[length:var(--text-xs)] font-bold uppercase tracking-[0.5px] text-[color:var(--color-fg-soft)]">
        媒体{readyCount > 0 && ` · 已上传 ${readyCount} 张`}
      </p>
      <ul className="grid grid-cols-3 gap-[var(--space-2)]">
        {uploadedMedia.map((media) => (
          <li key={media.uploadId} className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
            {media.status === 'ready' && media.mediaId ? (
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
            ) : media.status === 'failed' ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--color-error-bg)] text-[color:var(--color-error-active)]">
                <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-error)] text-[length:var(--text-sm)] font-bold text-white">!</span>
                <span className="text-[length:var(--text-xs)] font-bold">上传失败</span>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Spinner />
                <span className="absolute bottom-2 left-2 right-2 h-1 overflow-hidden rounded-full bg-white/50">
                  <span className="block h-full w-3/5 bg-[var(--color-primary)]" />
                </span>
              </div>
            )}
            {isRemovable(media) && (
              <button
                type="button"
                onClick={() => handleRemove(media)}
                aria-label="移除"
                className="absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-black/50 text-white"
                style={{ width: 22, height: 22 }}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        <li className="aspect-square">
          <UploadButton
            babyId={babyId}
            onUploaded={onUploaded}
            disabled={disabled}
            renderTrigger={({ click }) => (
              <button
                type="button"
                onClick={click}
                disabled={disabled}
                aria-label="添加照片或视频"
                className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--color-border-light)] bg-[var(--color-surface-2)] text-[color:var(--color-fg-soft)] active:bg-[var(--color-surface)] disabled:opacity-50"
              >
                <PlusIcon className="h-7 w-7" />
                <span className="text-[length:var(--text-xs)] font-bold">添加</span>
              </button>
            )}
          />
        </li>
      </ul>
    </div>
  );
}
