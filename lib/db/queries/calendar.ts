import { and, eq, gte, lt } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { babies, entries } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';

export interface MonthCell {
  date: Date;
  inMonth: boolean;
  iso: string;
}

export function listEntryDays({
  db,
  babyId,
  ym,
  timezone
}: {
  db: BetterSQLite3Database<typeof schema>;
  babyId: string;
  ym: string;
  timezone: string;
}) {
  const range = getMonthUtcRange(ym, timezone);
  const rows = db
    .select({ occurredAt: entries.occurredAt })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(
      and(
        eq(entries.babyId, babyId),
        eq(entries.status, 'active'),
        eq(babies.status, 'active'),
        gte(entries.occurredAt, range.start),
        lt(entries.occurredAt, range.end)
      )
    )
    .all();

  return new Set(rows.map((row) => formatDateInTimezone(row.occurredAt, timezone)));
}

export function buildMonthGrid(ym: string, _timezone: string): MonthCell[][] {
  const { year, month } = parseYm(ym);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: MonthCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - firstWeekday + i));
    const iso = toIsoDate(date);
    cells.push({
      date,
      iso,
      inMonth: date.getUTCMonth() === month - 1
    });
  }

  return Array.from({ length: 6 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

export function getMonthUtcRange(ym: string, timezone: string) {
  const { year, month } = parseYm(ym);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: zonedTimeToUtc(year, month, 1, timezone),
    end: zonedTimeToUtc(nextYear, nextMonth, 1, timezone)
  };
}

export function getDayUtcRange(iso: string, timezone: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const next = new Date(Date.UTC(year, month - 1, day + 1));

  return {
    start: zonedTimeToUtc(year, month, day, timezone),
    end: zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timezone)
  };
}

export function formatDateInTimezone(ms: number, timezone: string) {
  const parts = getZonedParts(new Date(ms), timezone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function zonedTimeToUtc(year: number, month: number, day: number, timezone: string) {
  let utc = Date.UTC(year, month - 1, day);

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utc), timezone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const wanted = Date.UTC(year, month - 1, day);
    utc += wanted - asUtc;
  }

  return utc;
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const entries = formatter.formatToParts(date).map((part) => [part.type, part.value]);
  const parts = Object.fromEntries(entries);
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function parseYm(ym: string) {
  const match = ym.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('invalid ym');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('invalid ym');
  return { year, month };
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
