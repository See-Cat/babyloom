import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastContext } from '@/components/ui/ToastProvider';
import { ComponentsDemo } from '@/app/(dev)/components/ComponentsDemo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/timeline'
}));

describe('ComponentsDemo', () => {
  it('lists every common component for visual testing', () => {
    const html = renderToStaticMarkup(
      <ToastContext.Provider value={{ show: () => undefined, dismiss: () => undefined }}>
        <ComponentsDemo />
      </ToastContext.Provider>
    );

    for (const name of [
      'Tokens',
      'Button',
      'Input',
      'Textarea',
      'Switch',
      'Tag',
      'Avatar',
      'AvatarPicker',
      'Card',
      'Spinner',
      'Toast',
      'Collapse',
      'DatePicker',
      'Modal',
      'BottomSheet',
      'ActionSheet',
      'AppShell',
      'Tabbar',
      'PullToRefresh',
      'FAB'
    ]) {
      expect(html).toContain(name);
    }
  });

  it('renders the reference state matrix labels used for visual acceptance', () => {
    const html = renderToStaticMarkup(
      <ToastContext.Provider value={{ show: () => undefined, dismiss: () => undefined }}>
        <ComponentsDemo />
      </ToastContext.Provider>
    );

    for (const label of [
      'md default',
      'md :active',
      'md :focus',
      'md disabled',
      'md loading',
      'filled',
      ':focus',
      'disabled',
      'leading icon',
      'trailing icon',
      'off',
      'on',
      'disabled off',
      'disabled on',
      'neutral',
      'accent',
      'error',
      'removable',
      '+N 溢出',
      'info + action',
      'error + action',
      'sm 16',
      'md 24',
      'lg 32',
      'idle',
      'pulling',
      'refreshing',
      'Modal / BottomSheet / ActionSheet'
    ]) {
      expect(html).toContain(label);
    }
  });
});
