'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { usePopupAnimation } from '@/lib/hooks/usePopupAnimation';
import { ChevronRightIcon } from './icons';

export type DatePickerMode = 'date' | 'datetime';

export interface DatePickerProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: DatePickerMode;
  placeholder?: string;
  required?: boolean;
  title?: string;
  disableFuture?: boolean;
}

interface DraftValue {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const ITEM_HEIGHT = 40;

export function DatePicker({
  label,
  mode = 'date',
  name,
  onChange,
  placeholder,
  required,
  title,
  value,
  disableFuture = true
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { mounted, visible } = usePopupAnimation(open, 300);
  const initial = React.useMemo(() => parseValue(value, mode) ?? defaultDraft(mode), [value, mode]);
  const [draft, setDraft] = React.useState<DraftValue>(initial);

  React.useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const years = React.useMemo(() => buildYears(), []);
  const months = React.useMemo(() => buildRange(1, 12), []);
  const days = React.useMemo(
    () => buildRange(1, daysInMonth(draft.year, draft.month)),
    [draft.year, draft.month]
  );
  const hours = React.useMemo(() => buildRange(0, 23), []);
  const minutes = React.useMemo(() => buildRange(0, 59), []);

  function updateDraft(patch: Partial<DraftValue>) {
    setDraft((current) => {
      const merged = { ...current, ...patch };
      const clampedDay = Math.min(merged.day, daysInMonth(merged.year, merged.month));
      return { ...merged, day: clampedDay };
    });
  }

  const formatted = formatValue(draft, mode);
  const isInvalid = disableFuture && isFuture(draft, mode);

  function confirm() {
    if (isInvalid) return;
    onChange(formatted);
    setOpen(false);
  }

  const sheetTitle = title ?? (mode === 'datetime' ? '选择时间' : '选择日期');
  const triggerLabel = value ? formatLabel(value, mode) : placeholder ?? (mode === 'datetime' ? '选择日期与时间' : '选择日期');

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
        <span className={cn(!value && 'placeholder')}>{triggerLabel}</span>
        <ChevronRightIcon className="chev h-4 w-4" />
      </button>

      {mounted && (
        <div className={cn('scrim', visible && 'show')} onMouseDown={() => setOpen(false)}>
          <div
            className={cn('date-sheet', visible && 'show')}
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="handle" />
            <div className="header">
              <button type="button" className="cancel" onClick={() => setOpen(false)}>
                取消
              </button>
              <h3>{sheetTitle}</h3>
              <button type="button" className="confirm" onClick={confirm} disabled={isInvalid}>
                确定
              </button>
            </div>
            <div className="wheels">
              <Wheel title="年" values={years} value={draft.year} onChange={(year) => updateDraft({ year })} />
              <Wheel title="月" values={months} value={draft.month} onChange={(month) => updateDraft({ month })} />
              <Wheel title="日" values={days} value={draft.day} onChange={(day) => updateDraft({ day })} />
              {mode === 'datetime' && (
                <>
                  <Wheel title="时" values={hours} value={draft.hour} pad onChange={(hour) => updateDraft({ hour })} />
                  <Wheel title="分" values={minutes} value={draft.minute} pad onChange={(minute) => updateDraft({ minute })} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface WheelProps {
  title: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
  pad?: boolean;
}

function Wheel({ title, values, value, onChange, pad: padded = false }: WheelProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const settleTimerRef = React.useRef<number | null>(null);

  const selectedIndex = Math.max(0, values.indexOf(value));

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const target = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(node.scrollTop - target) > 1) {
      node.scrollTop = target;
    }
  }, [selectedIndex, values.length]);

  function handleScroll() {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      const node = scrollRef.current;
      if (!node) return;
      const index = Math.round(node.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, index));
      const next = values[clamped];
      if (next !== value) onChange(next);
    }, 80);
  }

  function handleItemClick(item: number) {
    const node = scrollRef.current;
    if (!node) return;
    const target = values.indexOf(item) * ITEM_HEIGHT;
    node.scrollTo({ top: target, behavior: 'smooth' });
    if (item !== value) onChange(item);
  }

  return (
    <div className="wheel-col" role="group" aria-label={title}>
      <div className="wheel-col-label" aria-hidden="true">
        {title}
      </div>
      <div
        ref={scrollRef}
        className="wheel-scroll"
        role="listbox"
        aria-label={title}
        tabIndex={0}
        onScroll={handleScroll}
      >
        <div className="wheel-scroll-track">
          {values.map((item, index) => {
            const distance = Math.abs(index - selectedIndex);
            const selected = item === value;
            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'wheel-item',
                  selected && 'selected',
                  !selected && distance === 1 && 'near'
                )}
                onClick={() => handleItemClick(item)}
              >
                {padded ? String(item).padStart(2, '0') : item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildYears() {
  const now = new Date();
  const max = now.getFullYear();
  const min = max - 30;
  return buildRange(min, max);
}

function buildRange(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function defaultDraft(mode: DatePickerMode): DraftValue {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: mode === 'datetime' ? now.getHours() : 0,
    minute: mode === 'datetime' ? now.getMinutes() : 0
  };
}

function parseValue(raw: string, mode: DatePickerMode): DraftValue | null {
  if (!raw) return null;
  const datetime = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(raw);
  if (!datetime) return null;
  const draft: DraftValue = {
    year: Number(datetime[1]),
    month: Number(datetime[2]),
    day: Number(datetime[3]),
    hour: datetime[4] ? Number(datetime[4]) : 0,
    minute: datetime[5] ? Number(datetime[5]) : 0
  };
  if (mode === 'date') {
    draft.hour = 0;
    draft.minute = 0;
  }
  return draft;
}

function formatValue(draft: DraftValue, mode: DatePickerMode) {
  const date = `${draft.year}-${pad(draft.month)}-${pad(draft.day)}`;
  if (mode === 'datetime') {
    return `${date} ${pad(draft.hour)}:${pad(draft.minute)}`;
  }
  return date;
}

function formatLabel(value: string, mode: DatePickerMode) {
  const parsed = parseValue(value, mode);
  if (!parsed) return value;
  const date = `${parsed.year} 年 ${parsed.month} 月 ${parsed.day} 日`;
  if (mode === 'datetime') {
    return `${date} ${pad(parsed.hour)}:${pad(parsed.minute)}`;
  }
  return date;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function isFuture(draft: DraftValue, mode: DatePickerMode) {
  const target = new Date(
    draft.year,
    draft.month - 1,
    draft.day,
    mode === 'datetime' ? draft.hour : 0,
    mode === 'datetime' ? draft.minute : 0
  );
  return target.getTime() > Date.now();
}
