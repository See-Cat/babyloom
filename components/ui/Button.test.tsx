import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders variant, size, and full-width state', () => {
    const html = renderToStaticMarkup(
      <Button variant="default" size="lg" fullWidth>
        保存
      </Button>
    );

    expect(html).toContain('保存');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('data-size="lg"');
    expect(html).toContain('btn btn-lg btn-default');
    expect(html).toContain('w-full');
  });

  it('supports the design-language variants without press shadows on lightweight buttons', () => {
    const html = renderToStaticMarkup(
      <>
        <Button variant="ghost-primary">轻量</Button>
        <Button variant="text">文字</Button>
        <Button variant="link">链接</Button>
        <Button variant="danger" size="lg">删除</Button>
      </>
    );

    expect(html).toContain('data-variant="ghost-primary"');
    expect(html).toContain('data-variant="text"');
    expect(html).toContain('data-variant="link"');
    expect(html).toContain('data-variant="danger"');
    expect(html).toContain('btn-ghost');
    expect(html).toContain('btn-text');
    expect(html).toContain('btn-link');
    expect(html).toContain('btn-danger');
  });

  it('uses full press compensation without mobile hover lift', () => {
    const html = renderToStaticMarkup(<Button size="lg">发布</Button>);

    expect(html).toContain('btn btn-lg btn-primary');
    expect(html).not.toContain('hover:-translate-y');
    expect(html).not.toContain('shadow-[var(--shadow-press-hover)]');
  });

  it('treats loading as a visual state only — does not force disabled', () => {
    const html = renderToStaticMarkup(<Button loading>发布</Button>);

    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('spinner');
    expect(html).toContain('btn-loading');
  });

  it('honors explicit disabled alongside loading', () => {
    const html = renderToStaticMarkup(
      <Button loading disabled>
        发布
      </Button>
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('btn-loading');
  });
});
