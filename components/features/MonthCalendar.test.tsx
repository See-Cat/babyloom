import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MonthCalendar } from './MonthCalendar';
import type { MonthCell } from '@/lib/db/queries/calendar';

describe('MonthCalendar', () => {
  it('keeps day selection inside calendar and marks the selected date', () => {
    const date = new Date(Date.UTC(2026, 4, 24));
    const grid: MonthCell[][] = [[{ date, iso: '2026-05-24', inMonth: true }]];

    const html = renderToStaticMarkup(
      <MonthCalendar
        babyId="baby-1"
        ym="2026-05"
        grid={grid}
        daySet={new Set(['2026-05-24'])}
        todayIso="2026-05-25"
        selectedIso="2026-05-24"
      />
    );

    expect(html).toContain('/calendar?babyId=baby-1&amp;ym=2026-05&amp;date=2026-05-24');
    expect(html).toContain('aria-current="date"');
    expect(html).not.toContain('/timeline?babyId=baby-1');
  });
});
