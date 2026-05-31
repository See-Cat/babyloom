import { describe, expect, it } from 'vitest';
import { groupMediaByMonth } from './gallery';

describe('groupMediaByMonth', () => {
  it('groups rows by effective media month newest first', () => {
    const groups = groupMediaByMonth(
      [
        { id: 'older', takenAt: Date.UTC(2026, 3, 30), createdAt: Date.UTC(2026, 4, 2) },
        { id: 'newer', takenAt: null, createdAt: Date.UTC(2026, 4, 1) }
      ],
      'UTC'
    );

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

  it('buckets by the configured timezone month, not UTC', () => {
    // 2025-03-31 16:30 UTC is 2025-04-01 00:30 in Asia/Shanghai → April, not March.
    const row = { id: 'boundary', takenAt: Date.UTC(2025, 2, 31, 16, 30), createdAt: Date.UTC(2025, 2, 31, 16, 30) };
    expect(groupMediaByMonth([row], 'Asia/Shanghai')[0]).toMatchObject({ ym: '2025-04', label: '2025 年 4 月' });
    expect(groupMediaByMonth([row], 'UTC')[0]).toMatchObject({ ym: '2025-03', label: '2025 年 3 月' });
  });

  it('returns no groups for an empty list', () => {
    expect(groupMediaByMonth([], 'Asia/Shanghai')).toEqual([]);
  });
});
