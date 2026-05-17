import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders variant, size, and full-width state', () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" size="lg" fullWidth>
        保存
      </Button>
    );

    expect(html).toContain('保存');
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('data-size="lg"');
    expect(html).toContain('bl-button--full');
  });

  it('marks loading buttons as disabled and busy', () => {
    const html = renderToStaticMarkup(<Button loading>发布</Button>);

    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('bl-spinner');
  });
});
