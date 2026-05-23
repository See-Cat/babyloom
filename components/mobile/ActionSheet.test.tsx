import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';

vi.mock('@/lib/hooks/useDialog', () => ({
  useDialog: () => ({ panelRef: { current: null }, panelProps: { role: 'dialog' } })
}));

describe('ActionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders iOS-style action groups instead of raised buttons', () => {
    const html = renderToStaticMarkup(
      <ActionSheet
        open
        onOpenChange={() => undefined}
        title="记录操作"
        options={[
          { label: '编辑', onSelect: () => undefined },
          { label: '移到回收站', destructive: true, onSelect: () => undefined }
        ]}
      />
    );

    expect(html).toContain('bl-action-sheet');
    expect(html).toContain('编辑');
    expect(html).toContain('移到回收站');
    expect(html).not.toContain('bl-button');
    expect(html).toContain('text-[color:var(--color-error)]');
  });
});
