import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarMonthNav } from './CalendarMonthNav';

describe('CalendarMonthNav', () => {
  it('renders compact icon navigation around a pressed month pill', () => {
    const html = renderToStaticMarkup(<CalendarMonthNav babyId="baby-1" ym="2026-05" />);

    expect(html).toContain('aria-label="上个月"');
    expect(html).toContain('aria-label="下个月"');
    expect(html).toContain('2026 年 5 月');
    expect(html).toContain('/calendar?babyId=baby-1&amp;ym=2026-04');
    expect(html).toContain('/calendar?babyId=baby-1&amp;ym=2026-06');
    expect(html).toContain('shadow-[var(--shadow-press-sm)]');
    expect(html).not.toContain('上一月');
    expect(html).not.toContain('下一月');
  });
});
