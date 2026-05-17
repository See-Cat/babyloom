import { describe, expect, it } from 'vitest';
import { groupMediaByMonth } from './gallery';

describe('groupMediaByMonth', () => {
  it('groups rows by effective media month newest first', () => {
    const groups = groupMediaByMonth([
      { id: 'older', takenAt: Date.UTC(2026, 3, 30), createdAt: Date.UTC(2026, 4, 2) },
      { id: 'newer', takenAt: null, createdAt: Date.UTC(2026, 4, 1) }
    ]);

    expect(groups).toEqual([
      {
        ym: '2026-05',
        label: '2026 年 5 月',
        items: [{ id: 'newer', takenAt: null, createdAt: Date.UTC(2026, 4, 1) }]
      },
      {
        ym: '2026-04',
        label: '2026 年 4 月',
        items: [{ id: 'older', takenAt: Date.UTC(2026, 3, 30), createdAt: Date.UTC(2026, 4, 2) }]
      }
    ]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupMediaByMonth([])).toEqual([]);
  });
});
