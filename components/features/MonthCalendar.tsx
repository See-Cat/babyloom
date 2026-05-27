import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/shared/cn';
import type { MonthCell } from '@/lib/db/queries/calendar';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export function MonthCalendar({
  babyId,
  grid,
  daySet,
  todayIso,
  selectedIso
}: {
  babyId: string;
  grid: MonthCell[][];
  daySet: Set<string>;
  todayIso: string;
  selectedIso?: string;
}) {
  return (
    <div role="grid" aria-label="月份日历" className="grid gap-[var(--space-1)]">
      <div role="row" className="grid grid-cols-7 gap-[var(--space-1)]">
        {weekdays.map((day, idx) => (
          <div
            key={day}
            role="columnheader"
            className={cn(
              'py-[var(--space-1)] text-center text-[length:var(--text-xs)] font-bold tracking-wider',
              idx === 0 || idx === 6
                ? 'text-[color:var(--color-fg-disabled)]'
                : 'text-[color:var(--color-fg-soft)]'
            )}
          >
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
  cell,
  hasEntry,
  isToday,
  selected
}: {
  babyId: string;
  cell: MonthCell;
  hasEntry: boolean;
  isToday: boolean;
  selected: boolean;
}) {
  const className = cn(
    'relative flex aspect-square min-h-10 items-center justify-center rounded-[var(--radius-sm)] text-[length:var(--text-sm)] font-semibold transition-colors active:bg-black/[0.04]',
    selected
      ? 'bg-[var(--color-primary)] font-bold text-[color:var(--color-fg-inverse)]'
      : cell.inMonth
        ? cn(
            'bg-transparent text-[color:var(--color-fg)]',
            isToday && 'font-bold text-[color:var(--color-primary-active)]'
          )
        : 'bg-transparent text-[color:var(--color-fg-disabled)] opacity-40'
  );
  const day = cell.date.getUTCDate();
  const label = `${cell.date.getUTCFullYear()} 年 ${cell.date.getUTCMonth() + 1} 月 ${day} 日`;
  const targetYm = cell.iso.slice(0, 7);

  const inner = (
    <>
      {isToday && !selected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[6px] rounded-full ring-[1.5px] ring-[var(--color-primary)]"
        />
      )}
      <span className="relative">{day}</span>
      {hasEntry && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-[6px] h-[5px] w-[5px] rounded-full',
            selected ? 'bg-white' : 'bg-[var(--color-primary)]'
          )}
        />
      )}
    </>
  );

  return (
    <div role="gridcell" aria-label={label}>
      <Link
        className={className}
        href={`/calendar?babyId=${babyId}&ym=${targetYm}&date=${cell.iso}`}
        aria-current={selected ? 'date' : undefined}
      >
        {inner}
      </Link>
    </div>
  );
}
