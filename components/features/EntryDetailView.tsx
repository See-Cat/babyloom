import * as React from 'react';
import Link from 'next/link';
import { Gallery } from '@/components/media/Gallery';
import { AppShell } from '@/components/mobile/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';

interface EntryDetailViewProps {
  entry: {
    id: string;
    babyId: string;
    content: string;
    occurredAt: number;
    createdAt?: number | null;
  };
  babyName?: string | null;
  authorName?: string | null;
  authorImage?: string | null;
  milestoneNames: string[];
  mediaIds: string[];
  canEdit: boolean;
}

export function EntryDetailView({
  entry,
  babyName,
  authorName,
  authorImage,
  milestoneNames,
  mediaIds,
  canEdit
}: EntryDetailViewProps) {
  const recordedAt = entry.createdAt ?? entry.occurredAt;

  return (
    <AppShell
      leftSlot={
        <Link
          href={`/timeline?babyId=${entry.babyId}`}
          aria-label="返回时间线"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[var(--color-fg)] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
        >
          <ChevronLeftIcon />
        </Link>
      }
      rightSlot={
        canEdit ? (
          <Link
            href={`/entry/${entry.id}/edit`}
            aria-label="更多操作"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[var(--color-fg)] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
          >
            <DotsIcon />
          </Link>
        ) : null
      }
      className="max-w-2xl"
    >
      {mediaIds.length > 0 && (
        <Card className="mb-[var(--space-4)] px-[var(--space-3)] py-[var(--space-3)]">
          <Gallery mediaIds={mediaIds} />
        </Card>
      )}

      <Card as="article" className="bl-entry-detail">
        <p className="mb-[var(--space-3)] text-[var(--text-xs)] font-semibold text-[var(--color-fg-soft)]">
          {babyName ? `${babyName} · ` : ''}
          {formatDate(entry.occurredAt)} 记录
        </p>
        <p className="whitespace-pre-wrap text-[var(--text-lg)] font-medium leading-[var(--leading-relax)] text-[var(--color-fg)]">
          {entry.content}
        </p>

        {milestoneNames.length > 0 && (
          <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
            {milestoneNames.map((name) => (
              <Tag key={name} variant="accent">
                {name}
              </Tag>
            ))}
          </div>
        )}

        <div className="bl-entry-detail__author mt-[var(--space-5)] flex items-center gap-[var(--space-3)] border-t border-[var(--color-border-light)] pt-[var(--space-4)]">
          <Avatar
            src={authorImage ?? undefined}
            name={authorName ?? '未知'}
            alt={authorName ?? '未知'}
            size="sm"
          />
          <div>
            <p className="text-[var(--text-sm)] font-bold text-[var(--color-fg-strong)]">{authorName ?? '未知'}</p>
            <p className="text-[var(--text-xs)] font-semibold text-[var(--color-fg-soft)]">{formatDate(recordedAt)}</p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  );
}
