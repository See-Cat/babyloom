import { describe, expect, it } from 'vitest';
import { formatLongDateTime, formatRelativeDateTime, isValidTimeZone } from './format-time';

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
