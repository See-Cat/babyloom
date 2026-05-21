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
    expect(html).toContain('shadow-[var(--shadow-press-md)]');
  });

  it('renders gallery and calendar as live links', () => {
    const html = renderToStaticMarkup(<Tabbar />);

    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('href="/gallery"');
    expect(html).toContain('href="/calendar"');
    expect(html).not.toContain('shadow-[var(--shadow-card)]');
    expect(html).toContain('border-[var(--color-border-light)]');
  });
});
