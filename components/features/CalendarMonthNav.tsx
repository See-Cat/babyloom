'use client';

import * as React from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ChevronDownIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export function CalendarMonthNav({ babyId, ym, birthdayYm }: { babyId: string; ym: string; birthdayYm?: string }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(ym);

  React.useEffect(() => {
    setDraft(ym);
  }, [ym]);

  function confirm() {
    setOpen(false);
    window.location.href = `/calendar?babyId=${babyId}&ym=${draft}`;
  }

  const [draftYear, draftMonth] = draft.split('-').map(Number);
  const currentYear = new Date().getFullYear();
  const minYear = birthdayYm ? Number(birthdayYm.split('-')[0]) : currentYear - 5;
  const maxYear = currentYear + 1;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const thisMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

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
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="button" size="sm" variant="default" onClick={() => setDraft(thisMonth)}>回到本月</Button>
            {birthdayYm && (
              <Button type="button" size="sm" variant="default" onClick={() => setDraft(birthdayYm)}>出生月</Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <WheelColumn
              label="年"
              items={years.map((y) => ({ value: String(y), label: `${y}` }))}
              value={String(draftYear)}
              onChange={(v) => setDraft(`${v}-${String(draftMonth).padStart(2, '0')}`)}
            />
            <WheelColumn
              label="月"
              items={months.map((m) => ({ value: String(m).padStart(2, '0'), label: `${m} 月` }))}
              value={String(draftMonth).padStart(2, '0')}
              onChange={(v) => setDraft(`${draftYear}-${v}`)}
            />
          </div>
          <Button type="button" fullWidth onClick={confirm}>
            确定
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

interface WheelItem {
  value: string;
  label: string;
}

function WheelColumn({ label, items, value, onChange }: { label: string; items: WheelItem[]; value: string; onChange: (v: string) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const activeEl = node.querySelector<HTMLButtonElement>(`button[data-value="${value}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'center' });
    }
  }, [value]);

  return (
    <div className="rounded-[var(--radius-base)] bg-[var(--color-surface)] p-[var(--space-2)]">
      <p className="mb-[var(--space-1)] text-center text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-soft)]">{label}</p>
      <div ref={ref} className="h-[180px] overflow-y-auto" style={{ scrollSnapType: 'y mandatory' }}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            data-value={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'block w-full rounded-[var(--radius-sm)] py-[var(--space-2)] text-center text-[length:var(--text-md)] font-bold',
              item.value === value
                ? 'bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)]'
                : 'text-[color:var(--color-fg)]'
            )}
            style={{ scrollSnapAlign: 'center' }}
          >
            {item.label}
          </button>
        ))}
      </div>
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
