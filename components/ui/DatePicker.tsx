'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

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
        className="date-row"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={cn(!value && 'placeholder')}>{value ? formatLabel(value) : placeholder}</span>
        <span aria-hidden="true" className="chev">›</span>
      </button>
      {open && (
        <div className="scrim" onMouseDown={() => setOpen(false)}>
          <div className="date-sheet" role="dialog" aria-modal="true" aria-label="选择生日" onMouseDown={(event) => event.stopPropagation()}>
            <div className="handle" />
            <div className="header">
              <button type="button" className="cancel" onClick={() => setOpen(false)}>取消</button>
              <h3>选择生日</h3>
              <button type="button" className="confirm" onClick={confirm} disabled={isFutureDate(formatValue(draft))}>确定</button>
            </div>
            <div className="wheels">
              <DateColumn label="年" values={years} value={draft.year} onChange={(year) => updateDraft({ year })} />
              <DateColumn label="月" values={months} value={draft.month} onChange={(month) => updateDraft({ month })} />
              <DateColumn label="日" values={days} value={draft.day} onChange={(day) => updateDraft({ day })} />
            </div>
          </div>
        </div>
      )}
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
    <div role="listbox" aria-label={label} className="wheel">
      <div className="wheel-track">
      {values.map((item) => (
        <button
          key={item}
          type="button"
          role="option"
          aria-selected={item === value}
          className={cn(
            'wheel-item',
            Math.abs(values.indexOf(item) - values.indexOf(value)) === 1 && 'near',
            item === value && 'selected'
          )}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
      </div>
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
