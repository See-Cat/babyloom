'use client';

import * as React from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ChevronDownIcon } from '@/components/ui/icons';

export function CalendarMonthNav({ babyId, ym }: { babyId: string; ym: string }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(ym);

  React.useEffect(() => {
    setDraft(ym);
  }, [ym]);

  function confirm() {
    setOpen(false);
    window.location.href = `/calendar?babyId=${babyId}&ym=${draft}`;
  }

  return (
    <>
      <div className="mb-[var(--space-4)] flex items-center justify-between px-[var(--space-4)] pb-[var(--space-3)] pt-[var(--space-2)]">
        <Link
          href={`/calendar?babyId=${babyId}&ym=${shiftMonth(ym, -1)}`}
          aria-label="上个月"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg)] shadow-[var(--shadow-press-sm)] transition-[box-shadow,transform] duration-[var(--duration-press)] ease-[var(--ease)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
        >
          <ChevronLeftIcon />
        </Link>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="选择月份"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)] shadow-[var(--shadow-press-sm)] transition-[box-shadow,transform] duration-[var(--duration-press)] ease-[var(--ease)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
        >
          {monthLabel(ym)}
          <ChevronDownIcon className="h-4 w-4 text-[color:var(--color-fg-soft)]" />
        </button>
        <Link
          href={`/calendar?babyId=${babyId}&ym=${shiftMonth(ym, 1)}`}
          aria-label="下个月"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg)] shadow-[var(--shadow-press-sm)] transition-[box-shadow,transform] duration-[var(--duration-press)] ease-[var(--ease)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]"
        >
          <ChevronRightIcon />
        </Link>
      </div>
      <BottomSheet open={open} onOpenChange={setOpen} title="选择月份">
        <div className="grid gap-[var(--space-4)]">
          <label className="field">
            <span>月份</span>
            <input
              className="input"
              type="month"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <Button type="button" fullWidth onClick={confirm}>
            确定
          </Button>
        </div>
      </BottomSheet>
    </>
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
