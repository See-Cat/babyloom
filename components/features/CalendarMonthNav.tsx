import * as React from 'react';
import Link from 'next/link';

export function CalendarMonthNav({ babyId, ym }: { babyId: string; ym: string }) {
  return (
    <div className="mb-[var(--space-4)] flex items-center justify-between px-[var(--space-4)] pb-[var(--space-3)] pt-[var(--space-2)]">
      <Link
        href={`/calendar?babyId=${babyId}&ym=${shiftMonth(ym, -1)}`}
        aria-label="上个月"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg)] shadow-[var(--shadow-press-sm)] transition-[box-shadow,transform] duration-[var(--duration-press)] ease-[var(--ease)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
      >
        <ChevronLeftIcon />
      </Link>
      <span className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)] shadow-[var(--shadow-press-sm)]">
        {monthLabel(ym)}
        <ChevronDownIcon />
      </span>
      <Link
        href={`/calendar?babyId=${babyId}&ym=${shiftMonth(ym, 1)}`}
        aria-label="下个月"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg)] shadow-[var(--shadow-press-sm)] transition-[box-shadow,transform] duration-[var(--duration-press)] ease-[var(--ease)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
      >
        <ChevronRightIcon />
      </Link>
    </div>
  );
}

function shiftMonth(ym: string, delta: number) {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string) {
  const [year, month] = ym.split('-').map(Number);
  return `${year} 年 ${month} 月`;
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-[color:var(--color-fg-soft)]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
