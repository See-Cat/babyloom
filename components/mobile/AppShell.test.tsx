import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname()
}));

describe('AppShell', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/timeline');
  });

  it('renders title, children, and tabbar on app pages', () => {
    const html = renderToStaticMarkup(<AppShell title="时光">内容</AppShell>);

    expect(html).toContain('时光');
    expect(html).toContain('内容');
    expect(html).toContain('bl-tabbar');
  });

  it('hides tabbar on login and onboarding pages', () => {
    usePathname.mockReturnValue('/login');
    const html = renderToStaticMarkup(<AppShell title="登录">内容</AppShell>);

    expect(html).not.toContain('bl-tabbar');
  });
});
