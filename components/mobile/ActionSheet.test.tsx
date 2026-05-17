import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionSheet } from './ActionSheet';

describe('ActionSheet', () => {
  it('renders options and destructive state', () => {
    const html = renderToStaticMarkup(
      <ActionSheet
        open
        title="更多"
        onOpenChange={() => undefined}
        options={[
          { label: '编辑', onSelect: () => undefined },
          { label: '删除', destructive: true, onSelect: () => undefined }
        ]}
      />
    );

    expect(html).toContain('编辑');
    expect(html).toContain('删除');
    expect(html).toContain('data-destructive="true"');
  });
});
