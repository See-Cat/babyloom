import { describe, expect, it } from 'vitest';
import {
  formatLongDateTime,
  formatRelativeDateTime,
  isValidTimeZone,
  msUntilNextZonedMidnight,
  zonedParts,
  zonedWallTimeToMillis
} from './format-time';

// 2026-05-31T10:00:00Z → Shanghai 18:00, New York (EDT) 06:00
const MAY_31_10Z = Date.UTC(2026, 4, 31, 10, 0, 0);

describe('formatLongDateTime', () => {
  it('formats in the given timezone, independent of the ambient zone', () => {
    expect(formatLongDateTime(MAY_31_10Z, 'Asia/Shanghai')).toBe('2026 年 5 月 31 日 · 18:00');
    expect(formatLongDateTime(MAY_31_10Z, 'America/New_York')).toBe('2026 年 5 月 31 日 · 06:00');
  });
});

describe('formatRelativeDateTime', () => {
  it('labels same calendar day (in zone) as 今天', () => {
    const now = Date.UTC(2026, 4, 31, 12, 0, 0);
    expect(formatRelativeDateTime(MAY_31_10Z, 'Asia/Shanghai', now)).toBe('今天 18:00');
  });

  it('uses the zone to decide day boundaries, not UTC', () => {
    // value: 23:00 May 31 in Shanghai; now: 01:00 Jun 1 in Shanghai → 昨天
    const value = Date.UTC(2026, 4, 31, 15, 0, 0);
    const now = Date.UTC(2026, 4, 31, 17, 0, 0);
    expect(formatRelativeDateTime(value, 'Asia/Shanghai', now)).toBe('昨天 23:00');
  });

  it('drops the year for same-year dates older than a week', () => {
    const value = Date.UTC(2026, 0, 1, 2, 0, 0); // Jan 1 10:00 Shanghai
    const now = Date.UTC(2026, 4, 31, 2, 0, 0);
    expect(formatRelativeDateTime(value, 'Asia/Shanghai', now)).toBe('1 月 1 日 10:00');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones', () => {
    expect(isValidTimeZone('Asia/Shanghai')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects non-IANA / malformed values that would crash Intl', () => {
    expect(isValidTimeZone('UTC+8')).toBe(false);
    expect(isValidTimeZone('GMT+8')).toBe(false);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('zonedWallTimeToMillis', () => {
  it('interprets wall-clock parts as the given timezone (not the ambient one)', () => {
    // 08:00 in Shanghai (UTC+8) is 00:00 UTC the same day.
    expect(zonedWallTimeToMillis({ year: 2026, month: 5, day: 31, hour: 8, minute: 0 }, 'Asia/Shanghai')).toBe(
      Date.UTC(2026, 4, 31, 0, 0)
    );
    // 08:00 in New York (EDT, UTC-4) is 12:00 UTC.
    expect(zonedWallTimeToMillis({ year: 2026, month: 5, day: 31, hour: 8, minute: 0 }, 'America/New_York')).toBe(
      Date.UTC(2026, 4, 31, 12, 0)
    );
  });

  it('round-trips with zonedParts', () => {
    const wall = { year: 2026, month: 1, day: 1, hour: 0, minute: 30 };
    const ms = zonedWallTimeToMillis(wall, 'Asia/Shanghai');
    expect(zonedParts(ms, 'Asia/Shanghai')).toEqual(wall);
  });
});

describe('msUntilNextZonedMidnight', () => {
  it('counts from the current instant to the next midnight in the zone', () => {
    // 2026-05-31T15:30:00Z = 23:30 Shanghai → 30min to midnight (+1s cushion)
    const ms = msUntilNextZonedMidnight(Date.UTC(2026, 4, 31, 15, 30, 0), 'Asia/Shanghai');
    expect(ms).toBe(30 * 60 * 1000 + 1000);
  });

  it('returns close to a full day just after midnight', () => {
    // 2026-05-31T16:00:30Z = 00:00:30 Shanghai (Jun 1) → ~24h minus 30s
    const ms = msUntilNextZonedMidnight(Date.UTC(2026, 4, 31, 16, 0, 30), 'Asia/Shanghai');
    expect(ms).toBe((86_400 - 30) * 1000 + 1000);
  });
});
