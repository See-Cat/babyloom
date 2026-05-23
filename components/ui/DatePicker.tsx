'use client';

import * as React from 'react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface DatePickerProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const today = new Date();
const thisYear = today.getFullYear();
const years = Array.from({ length: 11 }, (_, index) => thisYear - 10 + index);
const months = Array.from({ length: 12 }, (_, index) => index + 1);

export function DatePicker({ label, name, onChange, placeholder = '选择生日', required, value }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseDate(value);
  const fallback = defaultDate();
  const [draft, setDraft] = React.useState(parsed ?? fallback);

  React.useEffect(() => {
    setDraft(parsed ?? fallback);
  }, [value]);

  const days = React.useMemo(
    () => Array.from({ length: daysInMonth(draft.year, draft.month) }, (_, index) => index + 1),
    [draft.month, draft.year]
  );

  function updateDraft(next: Partial<typeof draft>) {
    setDraft((current) => {
      const merged = { ...current, ...next };
      return { ...merged, day: Math.min(merged.day, daysInMonth(merged.year, merged.month)) };
    });
  }

  function confirm() {
    const next = formatValue(draft);
    if (isFutureDate(next)) return;
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1 text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
      <input type="hidden" name={name} value={value} required={required} />
      <span>{label}</span>
      <button
        type="button"
        className="bl-date-row flex h-10 w-full items-center justify-between rounded-[var(--radius-sm)] border-2 border-[var(--color-border-light)] bg-[var(--color-surface-2)] px-[14px] text-left text-[length:var(--text-md)] font-normal text-[color:var(--color-fg)] shadow-[var(--shadow-soft-sm)] outline-none focus:border-[var(--color-focus)] focus:shadow-[var(--shadow-focus)]"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={cn(!value && 'text-[color:var(--color-fg-disabled)]')}>{value ? formatLabel(value) : placeholder}</span>
        <span aria-hidden="true" className="text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">›</span>
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title="选择生日">
        <div className="grid h-[200px] grid-cols-[1.2fr_1fr_1fr] gap-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-[var(--space-2)]">
          <DateColumn label="年" values={years} value={draft.year} onChange={(year) => updateDraft({ year })} />
          <DateColumn label="月" values={months} value={draft.month} onChange={(month) => updateDraft({ month })} />
          <DateColumn label="日" values={days} value={draft.day} onChange={(day) => updateDraft({ day })} />
        </div>
        <div className="mt-[var(--space-4)] flex gap-[var(--space-2)]">
          <Button type="button" variant="ghost" fullWidth onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" fullWidth onClick={confirm} disabled={isFutureDate(formatValue(draft))}>
            确定
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function DateColumn({
  label,
  onChange,
  value,
  values
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div role="listbox" aria-label={label} className="overflow-y-auto px-[var(--space-1)]">
      {values.map((item) => (
        <button
          key={item}
          type="button"
          role="option"
          aria-selected={item === value}
          className={cn(
            'flex min-h-10 w-full items-center justify-center rounded-[var(--radius-sm)] text-[length:var(--text-base)] font-semibold text-[color:var(--color-fg-soft)]',
            item === value && 'bg-[var(--color-surface-2)] text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)] shadow-[var(--shadow-soft-sm)]'
          )}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function defaultDate() {
  const date = new Date(today);
  date.setFullYear(today.getFullYear() - 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatValue(date: { year: number; month: number; day: number }) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function formatLabel(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return value;
  return `${parsed.year} 年 ${parsed.month} 月 ${parsed.day} 日`;
}

function isFutureDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return false;
  return new Date(parsed.year, parsed.month - 1, parsed.day).getTime() > today.getTime();
}
