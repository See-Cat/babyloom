import * as React from 'react';
import Link from 'next/link';
import { TimelineCard } from '@/components/features/TimelineCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlusIcon } from '@/components/ui/icons';
import type { MediaItem } from '@/lib/server/media/types';

export interface CalendarPreviewEntry {
  id: string;
  content: string;
  occurredAt: number;
  authorName: string | null;
  authorImage: string | null;
  mediaItems: MediaItem[];
  milestoneNames?: string[];
}

export function CalendarDayPreview({
  babyAge,
  babyId,
  entries,
  selectedIso,
  todayIso,
  canWrite = true
}: {
  babyAge: string;
  babyId: string;
  entries: CalendarPreviewEntry[];
  selectedIso: string;
  todayIso?: string;
  canWrite?: boolean;
}) {
  const isToday = todayIso ? selectedIso === todayIso : false;
  return (
    <section className="mt-[var(--space-5)] grid gap-[var(--space-3)]" aria-label="当日预览">
      <div className="grid gap-[var(--space-2)]">
        <div className="flex items-baseline justify-between gap-[var(--space-3)]">
          <h2 className="text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">
            {formatSelectedDate(selectedIso)}
            <span className="ml-[var(--space-2)] text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
              {formatWeekday(selectedIso)}
              {isToday && ' · 今天'}
            </span>
          </h2>
          <span className="shrink-0 text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-soft)]">
            {entries.length > 0 ? `${entries.length} 条记录` : '无记录'}
          </span>
        </div>
        <p className="inline-flex w-fit items-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-[var(--color-primary-bg)] px-[var(--space-3)] py-[2px] text-[length:var(--text-xs)] font-bold text-[color:var(--color-primary-active)]">
          {babyAge.split(' · ').map((segment, idx) => (
            <React.Fragment key={segment}>
              {idx > 0 && <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-[color:var(--color-primary-active)] opacity-60" />}
              <span>{segment}</span>
            </React.Fragment>
          ))}
        </p>
      </div>

      {entries.length > 0 ? (
        <ul className="grid min-w-0 gap-[var(--space-3)]">
          {entries.map((entry, index) => (
            <li key={entry.id} className="min-w-0">
              <TimelineCard
                entry={{ id: entry.id, content: entry.content, occurredAt: entry.occurredAt }}
                authorName={entry.authorName ?? '家人'}
                authorImage={entry.authorImage}
                mediaItems={entry.mediaItems}
                milestoneNames={entry.milestoneNames ?? []}
                animationDelayMs={index * 50}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Card className="flex flex-col items-center gap-[var(--space-2)] py-[var(--space-6)] text-center">
          <span aria-hidden="true" className="text-[36px] leading-none">🌱</span>
          <p className="m-0 text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">这一天还没有记录</p>
          {canWrite && (
            <Link href={`/entry/new?babyId=${babyId}&date=${selectedIso}`}>
              <Button size="sm" leadingIcon={<PlusIcon />}>给这一天写一条</Button>
            </Link>
          )}
        </Card>
      )}
    </section>
  );
}

function formatSelectedDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '所选日期';
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
}

const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatWeekday(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return weekdayNames[date.getUTCDay()];
}
