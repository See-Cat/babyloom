import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimelineHero } from './TimelineHero';

describe('TimelineHero', () => {
  it('links to the highlighted entry and shows media count', () => {
    const html = renderToStaticMarkup(
      <TimelineHero
        entry={{
          id: 'entry-1',
          content: '今天第一次自己扶站，笑得很开心',
          occurredAt: new Date('2026-05-21T08:00:00Z').getTime()
        }}
        authorName="妈妈"
        mediaIds={['m1', 'm2']}
        babyId="baby-1"
      />
    );

    expect(html).toContain('href="/entry/entry-1"');
    expect(html).toContain('今天第一次自己扶站');
    expect(html).toMatch(/>\s*2\s*</);
    expect(html).toContain('bl-timeline-hero');
  });

  it('renders a dashed empty state that creates a new entry for the selected baby', () => {
    const html = renderToStaticMarkup(<TimelineHero babyId="baby-1" />);

    expect(html).toContain('href="/entry/new?babyId=baby-1"');
    expect(html).toContain('今天还没有记录');
    expect(html).toContain('border-dashed');
  });
});
