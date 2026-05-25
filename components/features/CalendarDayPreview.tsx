import * as React from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlusIcon } from '@/components/ui/icons';

interface CalendarPreviewEntry {
  id: string;
  content: string;
  occurredAt: number;
  authorName: string | null;
}

export function CalendarDayPreview({
  babyAge,
  babyId,
  entries,
  selectedIso
}: {
  babyAge: string;
  babyId: string;
  entries: CalendarPreviewEntry[];
  selectedIso: string;
}) {
  return (
    <section className="mt-[var(--space-5)] grid gap-[var(--space-3)]" aria-label="当日预览">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <div>
          <h2 className="text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">
            {formatSelectedDate(selectedIso)}
          </h2>
          <p className="mt-[var(--space-1)] inline-flex rounded-[var(--radius-pill)] bg-[var(--color-primary-bg)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-primary-active)]">
            {babyAge}
          </p>
        </div>
        <Link href={`/entry/new?babyId=${babyId}`}>
          <Button size="sm" variant="default" leadingIcon={<PlusIcon />}>
            补记
          </Button>
        </Link>
      </div>

      {entries.length > 0 ? (
        <ul className="grid gap-[var(--space-2)]">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link href={`/entry/${entry.id}`} className="block">
                <Card className="py-[var(--space-3)]">
                  <div className="flex gap-[var(--space-3)]">
                    <Avatar name={entry.authorName ?? '家人'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
                        {entry.authorName ?? '家人'} · {formatTime(entry.occurredAt)}
                      </p>
                      <p className="mt-[var(--space-1)] line-clamp-2 whitespace-pre-wrap text-[length:var(--text-sm)] font-semibold leading-[var(--leading-base)] text-[color:var(--color-fg)]">
                        {entry.content}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="text-center text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">
          这一天还没有记录
        </Card>
      )}
    </section>
  );
}

function formatSelectedDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '所选日期';
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
