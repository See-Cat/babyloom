import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarMonthNav } from './CalendarMonthNav';

describe('CalendarMonthNav', () => {
  it('renders compact icon navigation around an interactive month picker pill', () => {
    const html = renderToStaticMarkup(
      <CalendarMonthNav babyId="baby-1" ym="2026-05" todayYm="2026-05" />
    );

    expect(html).toContain('aria-label="上个月"');
    expect(html).toContain('aria-label="下个月"');
    expect(html).toContain('2026 年 5 月');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('选择月份');
    expect(html).toContain('shadow-[var(--shadow-press-sm)]');
    expect(html).not.toContain('上一月');
    expect(html).not.toContain('下一月');
  });

  it('disables the prev arrow at the birth-month boundary', () => {
    const html = renderToStaticMarkup(
      <CalendarMonthNav babyId="baby-1" ym="2025-11" todayYm="2026-05" birthdayYm="2025-11" />
    );

    expect(html).toContain('aria-label="上个月"');
    expect(html).toMatch(/aria-label="上个月"[^>]*aria-disabled="true"/);
    expect(html).not.toContain('href="/calendar?babyId=baby-1&amp;ym=2025-10"');
  });

  it('disables the next arrow when displaying the current month', () => {
    const html = renderToStaticMarkup(
      <CalendarMonthNav babyId="baby-1" ym="2026-05" todayYm="2026-05" birthdayYm="2025-11" />
    );

    expect(html).toMatch(/aria-label="下个月"[^>]*aria-disabled="true"/);
    expect(html).not.toContain('href="/calendar?babyId=baby-1&amp;ym=2026-06"');
    expect(html).toContain('href="/calendar?babyId=baby-1&amp;ym=2026-04"');
  });
});
