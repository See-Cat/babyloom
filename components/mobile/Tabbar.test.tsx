import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabbar } from './Tabbar';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname()
}));

describe('Tabbar', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/timeline');
  });

  it('marks the active existing tab', () => {
    const html = renderToStaticMarkup(<Tabbar />);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('时光');
    expect(html).toContain('class="dot"');
    expect(html).toContain('tab active');
  });

  it('renders gallery and calendar as live links', () => {
    const html = renderToStaticMarkup(<Tabbar />);

    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('href="/gallery"');
    expect(html).toContain('href="/calendar"');
    expect(html).not.toContain('shadow-[var(--shadow-card)]');
    expect(html).toContain('tabbar');
  });

  it('can render as an inline acceptance demo with an explicit active item', () => {
    usePathname.mockReturnValue('/components');

    const html = renderToStaticMarkup(<Tabbar fixed={false} activeHref="/timeline" />);

    expect(html).not.toContain('fixed bottom-0');
    expect(html).toContain('href="/timeline"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('tab active');
  });
});
