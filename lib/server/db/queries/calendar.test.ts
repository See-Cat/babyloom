import { describe, expect, it } from 'vitest';
import { buildMonthGrid, formatDateInTimezone, getMonthUtcRange } from './calendar';

describe('buildMonthGrid', () => {
  it('builds a Sunday-first six-week grid for a leap February', () => {
    const grid = buildMonthGrid('2024-02', 'Asia/Shanghai');

    expect(grid).toHaveLength(6);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0].iso).toBe('2024-01-28');
    expect(grid[0][4]).toMatchObject({ iso: '2024-02-01', inMonth: true });
    expect(grid[4][4]).toMatchObject({ iso: '2024-02-29', inMonth: true });
  });

  it('starts a Sunday month on the first cell', () => {
    const grid = buildMonthGrid('2026-02', 'Asia/Shanghai');

    expect(grid[0][0]).toMatchObject({ iso: '2026-02-01', inMonth: true });
  });
});

describe('timezone date helpers', () => {
  it('keeps a Shanghai month-end late entry on the local day', () => {
    const occurredAt = Date.UTC(2026, 4, 31, 15, 30);

    expect(formatDateInTimezone(occurredAt, 'Asia/Shanghai')).toBe('2026-05-31');
  });

  it('converts local month boundaries to UTC instants', () => {
    expect(getMonthUtcRange('2026-05', 'Asia/Shanghai')).toEqual({
      start: Date.UTC(2026, 3, 30, 16),
      end: Date.UTC(2026, 4, 31, 16)
    });
  });
});
