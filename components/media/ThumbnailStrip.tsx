import { MediaImage } from './MediaImage';

export function ThumbnailStrip({ mediaIds }: { mediaIds: string[] }) {
  if (mediaIds.length === 0) return null;
  return (
    <ul className="thumbnail-strip mt-[var(--space-3)] flex gap-[var(--space-2)]">
      {mediaIds.slice(0, 4).map((id) => (
        <li key={id} className="h-16 w-16 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <MediaImage mediaId={id} size="thumb" alt="" width={64} height={64} className="h-full w-full object-cover" />
        </li>
      ))}
      {mediaIds.length > 4 && (
        <li className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--text-sm)]">
          +{mediaIds.length - 4}
        </li>
      )}
    </ul>
  );
}
