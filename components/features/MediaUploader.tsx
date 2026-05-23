'use client';

import { MediaImage } from '@/components/media/MediaImage';
import { UploadButton, type UploadedMedia } from '@/components/media/UploadButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface MediaUploaderProps {
  babyId: string;
  uploadedMedia: UploadedMedia[];
  disabled?: boolean;
  onUploaded: (media: UploadedMedia) => void;
  onRemove: (mediaId: string) => void;
}

export function MediaUploader({ babyId, disabled, onRemove, onUploaded, uploadedMedia }: MediaUploaderProps) {
  return (
    <div>
      <p className="mb-[var(--space-2)] text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-strong)]">照片 / 视频</p>
      <UploadButton babyId={babyId} onUploaded={onUploaded} disabled={disabled} className="flex flex-col gap-[var(--space-2)]" />
      {uploadedMedia.length > 0 && (
        <ul className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
          {uploadedMedia.map((media) => (
            <li key={media.mediaId}>
              <Card className="flex items-center gap-[var(--space-2)] p-[var(--space-2)]">
                {media.status === 'ready' ? (
                  <MediaImage mediaId={media.mediaId} size="thumb" alt={media.filename} width={64} height={64} className="h-16 w-16 rounded-[var(--radius-sm)] object-cover" />
                ) : (
                  <span className="text-[length:var(--text-sm)]">上传中… {media.filename}</span>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(media.mediaId)}>
                  移除
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
