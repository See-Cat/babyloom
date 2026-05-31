import { describe, expect, it } from 'vitest';
import { babyAge, formatBabyAgeShort } from './baby-age';

describe('babyAge', () => {
  it('computes years/months/days from calendar dates in the zone', () => {
    // Born 2025-03-15; measured 2026-03-15 12:00 Shanghai → exactly 1 year.
    const age = babyAge('2025-03-15', Date.UTC(2026, 2, 15, 4, 0), 'Asia/Shanghai');
    expect(age).toEqual({ years: 1, months: 0, days: 366 });
  });

  it('uses the configured zone, not UTC, for the occurrence date', () => {
    // 2026-04-01 02:00 Shanghai is 2026-03-31 18:00 UTC. With UTC date parts the
    // age would read 11 months; in Shanghai it is a clean 1 year.
    const atMs = Date.UTC(2026, 2, 31, 18, 0);
    expect(babyAge('2025-04-01', atMs, 'Asia/Shanghai')).toEqual({ years: 1, months: 0, days: 366 });
    expect(babyAge('2025-04-01', atMs, 'UTC')).toEqual({ years: 0, months: 11, days: 365 });
  });

  it('returns null for a malformed birthday', () => {
    expect(babyAge('not-a-date', Date.now(), 'Asia/Shanghai')).toBeNull();
  });
});

describe('formatBabyAgeShort', () => {
  it('drops the years segment under a year', () => {
    expect(formatBabyAgeShort({ years: 0, months: 5, days: 150 })).toBe('5个月');
    expect(formatBabyAgeShort({ years: 1, months: 3, days: 458 })).toBe('1岁3月');
  });
});
