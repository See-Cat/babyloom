import Link from 'next/link';
import { MediaImage } from '@/components/media/MediaImage';
import { Card } from '@/components/ui/Card';
import type { GalleryMonthGroup, GalleryMedia } from '@/lib/db/queries/gallery';

export function GalleryGrid({ groups }: { groups: Array<GalleryMonthGroup<GalleryMedia>> }) {
  if (groups.length === 0) {
    return (
      <Card>
        <p className="text-[var(--text-sm)] text-[var(--color-muted)]">
          还没有照片，去
          <Link className="font-bold text-[var(--color-accent)]" href="/entry/new">
            新建记录
          </Link>
          添加一条
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-[var(--space-5)]">
      {groups.map((group) => (
        <section key={group.ym} aria-labelledby={`gallery-${group.ym}`}>
          <h2 id={`gallery-${group.ym}`} className="mb-[var(--space-2)] text-[var(--text-lg)] font-bold text-[var(--color-fg-strong)]">
            {group.label}
          </h2>
          <div className="grid grid-cols-3 gap-[var(--space-1)]">
            {group.items.map((item) => (
              <GalleryTile key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GalleryTile({ item }: { item: GalleryMedia }) {
  const href = item.entryId ? `/entry/${item.entryId}` : `/api/media/${item.id}?size=large`;
  const isBare = !item.entryId;
  const label = item.filename || '宝宝照片';

  const content = (
    <span className="relative block aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
      <MediaImage
        mediaId={item.id}
        alt={label}
        width={item.width ?? 240}
        height={item.height ?? 240}
        className="h-full w-full object-cover"
      />
      {item.type === 'video' && (
        <span className="absolute bottom-1 right-1 rounded-[var(--radius-pill)] bg-[var(--color-media-badge)] px-2 py-1 text-[var(--text-xs)] font-bold text-[var(--color-fg-inverse)]">
          ▶ {formatDuration(item.durationSec)}
        </span>
      )}
    </span>
  );

  return isBare ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {content}
    </a>
  ) : (
    <Link href={href} aria-label={label}>
      {content}
    </Link>
  );
}

function formatDuration(seconds: number | null) {
  const total = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
