import Link from 'next/link';
import { ThumbnailStrip } from '@/components/media/ThumbnailStrip';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';

export interface TimelineCardProps {
  entry: {
    id: string;
    content: string;
    occurredAt: number;
  };
  authorName?: string | null;
  authorImage?: string | null;
  mediaIds?: string[];
}

export function TimelineCard({ entry, authorName = '未知', authorImage, mediaIds = [] }: TimelineCardProps) {
  return (
    <Card as="article" interactive>
      <Link href={`/entry/${entry.id}`} className="block">
        <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
          <Avatar
            src={authorImage ?? undefined}
            name={authorName ?? '未知'}
            alt={authorName ?? '未知'}
            size="sm"
          />
          <div>
            <p className="text-[var(--text-sm)] font-bold text-[var(--color-fg-strong)]">{authorName}</p>
            <p className="text-[var(--text-xs)] text-[var(--color-muted)]">
              {new Date(entry.occurredAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <p className="line-clamp-3 whitespace-pre-wrap">{entry.content}</p>
        <ThumbnailStrip mediaIds={mediaIds} />
      </Link>
    </Card>
  );
}
