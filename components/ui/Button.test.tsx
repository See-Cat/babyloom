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

  it('uses full press compensation without mobile hover lift', () => {
    const html = renderToStaticMarkup(<Button size="lg">发布</Button>);

    expect(html).toContain('shadow-[var(--shadow-press-lg)]');
    expect(html).toContain('active:translate-y-[4px]');
    expect(html).toContain('active:shadow-[var(--shadow-press-lg-active)]');
    expect(html).not.toContain('hover:-translate-y');
    expect(html).not.toContain('shadow-[var(--shadow-press-hover)]');
  });

  it('marks loading buttons as disabled and busy', () => {
    const html = renderToStaticMarkup(<Button loading>发布</Button>);

    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('bl-spinner');
    expect(html).toContain('shadow-none');
  });
});
