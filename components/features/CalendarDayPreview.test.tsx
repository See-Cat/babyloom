import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarDayPreview } from './CalendarDayPreview';

describe('CalendarDayPreview', () => {
  it('renders selected-day age, entries, and an add-record CTA', () => {
    const html = renderToStaticMarkup(
      <CalendarDayPreview
        babyId="baby-1"
        selectedIso="2026-05-24"
        babyAge="1岁3月 · 第 457 天"
        entries={[
          {
            id: 'entry-1',
            content: '今天会自己扶站了',
            occurredAt: Date.UTC(2026, 4, 24, 8, 30),
            authorName: '妈妈'
          }
        ]}
      />
    );

    expect(html).toContain('1岁3月 · 第 457 天');
    expect(html).toContain('今天会自己扶站了');
    expect(html).toContain('/entry/entry-1');
  });

  it('renders empty-day state with sprout emoji and add-record CTA', () => {
    const html = renderToStaticMarkup(
      <CalendarDayPreview
        babyId="baby-1"
        selectedIso="2026-05-24"
        babyAge="1岁3月"
        entries={[]}
      />
    );

    expect(html).toContain('这一天还没有记录');
    expect(html).toContain('🌱');
    expect(html).toContain('/entry/new?babyId=baby-1');
  });
});
