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
    expect(html).toContain('bl-button--full');
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
    expect(html).toContain('underline');
    expect(html).toContain('--button-shadow:0 5px 0 0 var(--color-press-shadow-error)');
    expect(html).toContain('data-press-shadow="false"');
  });

  it('uses full press compensation without mobile hover lift', () => {
    const html = renderToStaticMarkup(<Button size="lg">发布</Button>);

    expect(html).toContain('shadow-[var(--button-shadow)]');
    expect(html).toContain('active:translate-y-[4px]');
    expect(html).toContain('active:shadow-[var(--button-shadow-active)]');
    expect(html).toContain('--button-shadow:0 5px 0 0 var(--color-press-shadow-primary)');
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
