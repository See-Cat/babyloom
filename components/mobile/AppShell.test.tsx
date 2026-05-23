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

  it('renders title, subtitle, children, and tabbar on app pages', () => {
    const html = renderToStaticMarkup(<AppShell title="小乐的成长" subtitle="1岁3月 · 第 456 天">内容</AppShell>);

    expect(html).toContain('小乐的成长');
    expect(html).toContain('1岁3月 · 第 456 天');
    expect(html).toContain('内容');
    expect(html).toContain('tabbar');
  });

  it('hides tabbar on login and onboarding pages', () => {
    usePathname.mockReturnValue('/login');
    const html = renderToStaticMarkup(<AppShell title="登录">内容</AppShell>);

    expect(html).not.toContain('tabbar');
  });

  it('can render reading pages without a visible title', () => {
    const html = renderToStaticMarkup(<AppShell leftSlot="返回" rightSlot="更多">内容</AppShell>);

    expect(html).toContain('返回');
    expect(html).toContain('更多');
    expect(html).toContain('内容');
    expect(html).not.toContain('<h1');
  });
});
