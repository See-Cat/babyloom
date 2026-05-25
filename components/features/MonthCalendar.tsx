import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { MonthCell } from '@/lib/db/queries/calendar';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export function MonthCalendar({
  babyId,
  ym,
  grid,
  daySet,
  todayIso,
  selectedIso
}: {
  babyId: string;
  ym: string;
  grid: MonthCell[][];
  daySet: Set<string>;
  todayIso: string;
  selectedIso?: string;
}) {
  return (
    <div role="grid" aria-label="月份日历" className="grid gap-[var(--space-1)]">
      <div role="row" className="grid grid-cols-7 gap-[var(--space-1)]">
        {weekdays.map((day) => (
          <div key={day} role="columnheader" className="py-[var(--space-1)] text-center text-[length:var(--text-xs)] font-bold text-[color:var(--color-muted)]">
            {day}
          </div>
        ))}
      </div>
      {grid.map((week, index) => (
        <div key={index} role="row" className="grid grid-cols-7 gap-[var(--space-1)]">
          {week.map((cell) => (
            <CalendarCell
              key={cell.iso}
              babyId={babyId}
              ym={ym}
              cell={cell}
              hasEntry={daySet.has(cell.iso)}
              isToday={cell.iso === todayIso}
              selected={cell.iso === selectedIso}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CalendarCell({
  babyId,
  ym,
  cell,
  hasEntry,
  isToday,
  selected
}: {
  babyId: string;
  ym: string;
  cell: MonthCell;
  hasEntry: boolean;
  isToday: boolean;
  selected: boolean;
}) {
  const className = cn(
    'relative flex aspect-square min-h-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[length:var(--text-sm)] font-bold',
    cell.inMonth ? 'text-[color:var(--color-fg)]' : 'text-[color:var(--color-muted)] opacity-45',
    isToday && 'ring-2 ring-[var(--color-primary)]',
    selected && 'bg-[var(--color-primary-bg)] ring-2 ring-[var(--color-primary)]'
  );
  const day = cell.date.getUTCDate();
  const label = `${cell.date.getUTCFullYear()} 年 ${cell.date.getUTCMonth() + 1} 月 ${day} 日`;

  const inner = (
    <>
      <span>{day}</span>
      {hasEntry && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />}
    </>
  );

  return (
    <div role="gridcell" aria-label={label}>
      {cell.inMonth ? (
        <Link
          className={className}
          href={`/calendar?babyId=${babyId}&ym=${ym}&date=${cell.iso}`}
          aria-current={selected ? 'date' : undefined}
        >
          {inner}
        </Link>
      ) : (
        <span className={className}>{inner}</span>
      )}
    </div>
  );
}
