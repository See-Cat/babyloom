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
  });

  it('renders future tabs as disabled placeholders', () => {
    const html = renderToStaticMarkup(<Tabbar />);

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('画廊');
    expect(html).toContain('日历');
  });
});
