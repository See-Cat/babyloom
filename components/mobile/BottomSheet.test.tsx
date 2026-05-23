import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('renders a dialog panel with handle and title', () => {
    const html = renderToStaticMarkup(
      <BottomSheet open onOpenChange={() => undefined} title="选择里程碑">
        内容
      </BottomSheet>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('class="handle"');
    expect(html).toContain('sheet show');
    expect(html).toContain('选择里程碑');
  });
});
