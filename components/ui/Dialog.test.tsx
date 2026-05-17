import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} onOpenChange={() => undefined} title="确认">
        内容
      </Dialog>
    );

    expect(html).toBe('');
  });

  it('renders accessible dialog semantics when open', () => {
    const html = renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="确认删除" description="删除后可在垃圾桶恢复">
        内容
      </Dialog>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('确认删除');
    expect(html).toContain('删除后可在垃圾桶恢复');
  });
});
