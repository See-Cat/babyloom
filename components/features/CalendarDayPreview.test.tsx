import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CalendarDayPreview } from './CalendarDayPreview';

vi.mock('next/navigation', () => ({
  usePathname: () => '/calendar',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

describe('CalendarDayPreview', () => {
  it('renders selected-day age, entries, and an add-record CTA', () => {
    const html = renderToStaticMarkup(
      <CalendarDayPreview
        babyId="baby-1"
        selectedIso="2026-05-24"
        todayIso="2026-05-24"
        babyAge="1岁3月 · 第 457 天"
        entries={[
          {
            id: 'entry-1',
            content: '今天会自己扶站了',
            occurredAt: Date.UTC(2026, 4, 24, 8, 30),
            authorName: '妈妈',
            authorImage: null,
            authorAvatarColor: 'blue',
            mediaItems: []
          }
        ]}
      />
    );

    expect(html).toContain('1岁3月');
    expect(html).toContain('第 457 天');
    expect(html).toContain('今天会自己扶站了');
    expect(html).toContain('/entry/entry-1');
    expect(html).toContain('星期日');
    expect(html).toContain('今天');
    expect(html).toContain('1 条记录');
    expect(html).toContain('data-color="blue"');
  });

  it('allows media-heavy record grid items to shrink within the viewport', () => {
    const html = renderToStaticMarkup(
      <CalendarDayPreview
        babyId="baby-1"
        selectedIso="2026-05-24"
        babyAge="1岁3月"
        entries={[
          {
            id: 'entry-with-media',
            content: '很多照片',
            occurredAt: Date.UTC(2026, 4, 24, 8, 30),
            authorName: '爸爸',
            authorImage: null,
            mediaItems: Array.from({ length: 8 }, (_, index) => ({
              id: `media-${index}`,
              type: 'photo' as const,
              durationSec: null
            }))
          }
        ]}
      />
    );

    expect(html).toContain('class="grid min-w-0 gap-[var(--space-3)]"');
    expect(html).toContain('<li class="min-w-0">');
    expect(html).toContain('overflow-x-auto');
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
