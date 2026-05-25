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
        {weekdays.map((day, idx) => (
          <div
            key={day}
            role="columnheader"
            className={cn(
              'py-[var(--space-1)] text-center text-[length:var(--text-xs)] font-bold',
              idx === 0 || idx === 6 ? 'text-[color:var(--color-fg-soft)] opacity-60' : 'text-[color:var(--color-muted)]'
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
    'relative flex aspect-square min-h-10 items-center justify-center rounded-[var(--radius-sm)] text-[length:var(--text-sm)] font-bold transition-colors',
    selected
      ? 'bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)] shadow-[0_3px_0_0_var(--color-primary-active)]'
      : cell.inMonth
        ? 'bg-[var(--color-surface)] text-[color:var(--color-fg)]'
        : 'bg-[var(--color-surface)] text-[color:var(--color-muted)] opacity-45'
  );
  const day = cell.date.getUTCDate();
  const label = `${cell.date.getUTCFullYear()} 年 ${cell.date.getUTCMonth() + 1} 月 ${day} 日`;

  const inner = (
    <>
      {isToday && !selected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[5px] rounded-[var(--radius-sm)] ring-[1.5px] ring-[var(--color-primary)]"
        />
      )}
      <span className="relative">{day}</span>
      {hasEntry && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-[5px] h-[5px] w-[5px] rounded-full',
            selected ? 'bg-white/90' : 'bg-[var(--color-primary)]'
          )}
        />
      )}
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
