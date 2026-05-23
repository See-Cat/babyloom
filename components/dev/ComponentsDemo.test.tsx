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
});
