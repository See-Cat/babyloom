import type { UploadedMedia } from '@/components/media/UploadButton';

/**
 * Reducer for the uploaded-media list shared by the entry composer pages.
 *
 * - Known `uploadId` → replace in place (pending → uploading → ready/failed).
 * - New `uploadId` → append ONLY while still pending (queued/uploading).
 *
 * The append guard is what prevents a removed upload from reappearing: if the
 * user removes an item while it is uploading, the later ready/failed callback
 * arrives with an id no longer in the list and is ignored instead of re-added.
 */
export function applyUploadedMedia(prev: UploadedMedia[], media: UploadedMedia): UploadedMedia[] {
  const index = prev.findIndex((item) => item.uploadId === media.uploadId);
  if (index >= 0) {
    const next = prev.slice();
    next[index] = media;
    return next;
  }
  return media.status === 'pending' ? [...prev, media] : prev;
}
