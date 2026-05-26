'use client';

import * as React from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { ChevronDownIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export function CalendarMonthNav({
  babyId,
  ym,
  todayYm,
  birthdayYm
}: {
  babyId: string;
  ym: string;
  todayYm: string;
  birthdayYm?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(ym);

  React.useEffect(() => {
    setDraft(ym);
  }, [ym]);

  const [todayYear, todayMonth] = todayYm.split('-').map(Number);
  const birthParts = birthdayYm?.split('-').map(Number);
  // Default minimum: 10 years back. With birthday: clamp to that year/month.
  const minYear = birthParts?.[0] ?? todayYear - 10;
  const minMonth = birthParts?.[1] ?? 1;
  const minYm = `${minYear}-${String(minMonth).padStart(2, '0')}`;
  const maxYm = todayYm;

  const monthsForYear = React.useCallback(
    (year: number): number[] => {
      const lo = year === minYear ? minMonth : 1;
      const hi = year === todayYear ? todayMonth : 12;
      if (lo > hi) return [];
      return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    },
    [minYear, minMonth, todayYear, todayMonth]
  );

  const years = Array.from({ length: todayYear - minYear + 1 }, (_, i) => minYear + i);
  const [draftYear, draftMonth] = draft.split('-').map(Number);
  const monthItems = monthsForYear(draftYear);

  // Clamp draft if the current month falls outside the new year's valid range.
  function setDraftYM(year: number, month: number) {
    const valid = monthsForYear(year);
    if (valid.length === 0) return;
    const clamped = Math.min(Math.max(month, valid[0]), valid[valid.length - 1]);
    setDraft(`${year}-${String(clamped).padStart(2, '0')}`);
  }

  function confirm() {
    setOpen(false);
    window.location.href = `/calendar?babyId=${babyId}&ym=${draft}`;
  }

  const prevYm = shiftMonth(ym, -1);
  const nextYm = shiftMonth(ym, 1);
  const prevDisabled = prevYm < minYm;
  const nextDisabled = nextYm > maxYm;

  return (
    <>
      <div className="mb-[var(--space-4)] flex items-center justify-between px-[var(--space-4)] pb-[var(--space-3)] pt-[var(--space-2)]">
        <NavArrow
          direction="prev"
          disabled={prevDisabled}
          href={`/calendar?babyId=${babyId}&ym=${prevYm}`}
        />
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
        <NavArrow
          direction="next"
          disabled={nextDisabled}
          href={`/calendar?babyId=${babyId}&ym=${nextYm}`}
        />
      </div>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="选择月份"
        leadingAction={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="bg-transparent p-0 text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]"
          >
            取消
          </button>
        }
        trailingAction={
          <button
            type="button"
            onClick={confirm}
            className="bg-transparent p-0 text-[length:var(--text-sm)] font-bold text-[color:var(--color-primary-active)]"
          >
            确定
          </button>
        }
      >
        <div className="grid gap-[var(--space-4)]">
          <div className="relative grid grid-cols-[1.3fr_1fr] overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 rounded-[var(--radius-sm)] bg-[var(--color-surface)]"
            />
            <WheelColumn
              ariaLabel="年"
              items={years.map((y) => ({ value: String(y), label: `${y}` }))}
              value={String(draftYear)}
              onChange={(v) => setDraftYM(Number(v), draftMonth)}
            />
            <WheelColumn
              ariaLabel="月"
              items={monthItems.map((m) => ({ value: String(m).padStart(2, '0'), label: `${m} 月` }))}
              value={String(draftMonth).padStart(2, '0')}
              onChange={(v) => setDraftYM(draftYear, Number(v))}
            />
          </div>
          <div className="flex justify-center gap-[var(--space-2)]">
            <button
              type="button"
              onClick={() => setDraft(todayYm)}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)] active:bg-[var(--color-bg)]"
            >
              回到本月
            </button>
            {birthdayYm && (
              <button
                type="button"
                onClick={() => setDraft(birthdayYm)}
                className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)] active:bg-[var(--color-bg)]"
              >
                出生月
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function NavArrow({
  direction,
  disabled,
  href
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  href: string;
}) {
  const label = direction === 'prev' ? '上个月' : '下个月';
  const icon = direction === 'prev' ? <ChevronLeftIcon /> : <ChevronRightIcon />;
  const className = cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[length:var(--text-xl)] font-bold transition-colors',
    disabled
      ? 'cursor-not-allowed text-[color:var(--color-fg-disabled)] opacity-40'
      : 'text-[color:var(--color-fg)] active:bg-black/[0.04]'
  );

  if (disabled) {
    return (
      <span aria-label={label} aria-disabled="true" className={className}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      {icon}
    </Link>
  );
}

interface WheelItem {
  value: string;
  label: string;
}

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5;

function WheelColumn({
  ariaLabel,
  items,
  value,
  onChange
}: {
  ariaLabel: string;
  items: WheelItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === value));

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTo({ top: activeIndex * ITEM_HEIGHT, behavior: 'auto' });
  }, [activeIndex]);

  function onScroll() {
    const node = ref.current;
    if (!node) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const node2 = ref.current;
      if (!node2) return;
      const idx = Math.round(node2.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const next = items[clamped]?.value;
      if (next && next !== value) onChange(next);
      else node2.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
    }, 90);
  }

  const totalHeight = VISIBLE_ROWS * ITEM_HEIGHT;
  const padHeight = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={onScroll}
      className="wheel-fade-mask relative z-[1] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        height: totalHeight,
        scrollSnapType: 'y mandatory'
      }}
    >
      <div style={{ height: padHeight }} aria-hidden="true" />
      {items.map((item, idx) => {
        const distance = Math.abs(idx - activeIndex);
        const isSelected = idx === activeIndex;
        return (
          <button
            key={item.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex w-full items-center justify-center bg-transparent font-medium tabular-nums transition-colors',
              isSelected
                ? 'text-[16px] font-bold text-[color:var(--color-fg-strong)]'
                : distance === 1
                  ? 'text-[length:var(--text-sm)] text-[color:var(--color-fg)]'
                  : 'text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]'
            )}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center' }}
          >
            {item.label}
          </button>
        );
      })}
      <div style={{ height: padHeight }} aria-hidden="true" />
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
