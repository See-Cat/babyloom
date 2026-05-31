const MS_PER_DAY = 86_400_000;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

// Resolve a timestamp into calendar parts for an explicit IANA timezone. Using
// Intl with a fixed `timeZone` makes the result independent of the ambient
// timezone, so server (often UTC) and client (the viewer's device) agree — which
// is what prevents the relative-time hydration mismatch (React error #418).
function zonedParts(ms: number, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute)
  };
}

function hm(parts: ZonedParts): string {
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

// Midnight (in `timeZone`) of the given instant, expressed as a UTC ordinal so
// two such values can be subtracted into a whole-day difference.
function zonedDayOrdinal(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function formatRelativeDateTime(value: number, timeZone: string, now: number = Date.now()): string {
  const target = zonedParts(value, timeZone);
  const today = zonedParts(now, timeZone);
  const diffDays = Math.round((zonedDayOrdinal(today) - zonedDayOrdinal(target)) / MS_PER_DAY);
  const t = hm(target);
  if (diffDays === 0) return `今天 ${t}`;
  if (diffDays === 1) return `昨天 ${t}`;
  if (diffDays === 2) return `前天 ${t}`;
  if (diffDays > 2 && diffDays < 7) return `${diffDays} 天前 ${t}`;
  if (target.year === today.year) return `${target.month} 月 ${target.day} 日 ${t}`;
  return `${target.year} 年 ${target.month} 月 ${target.day} 日 ${t}`;
}

export function formatLongDateTime(value: number, timeZone: string): string {
  const p = zonedParts(value, timeZone);
  return `${p.year} 年 ${p.month} 月 ${p.day} 日 · ${hm(p)}`;
}

// Guard config-supplied timezones before they reach Intl during render: a
// non-IANA value (e.g. "UTC+8", "GMT+8", a typo) makes Intl.DateTimeFormat throw
// a RangeError, which would crash the whole render tree.
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Milliseconds from `nowMs` to the next midnight in `timeZone`, used to schedule a
// relative-time refresh so "今天/昨天" stays correct across the day boundary without
// a full reload. DST-naive (assumes 24h days); the caller reschedules after each
// fire, so a rare ±1h drift on a DST day self-corrects.
export function msUntilNextZonedMidnight(nowMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const secondsToday = hour * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return (86_400 - secondsToday) * 1000 + 1_000; // land ~1s past midnight
}

export function parseBirthdayToMillis(birthday: string): number | null {
  const match = birthday.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const ms = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    match[4] ? Number(match[4]) : 0,
    match[5] ? Number(match[5]) : 0
  ).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function birthdayDatePart(birthday: string): string {
  return birthday.slice(0, 10);
}
