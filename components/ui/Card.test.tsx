import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children with the surface card class', () => {
    const html = renderToStaticMarkup(<Card>小记忆</Card>);

    expect(html).toContain('小记忆');
    expect(html).toContain('card');
    expect(html).not.toContain('shadow-[var(--shadow-card)]');
  });

  it('supports semantic element and interactive state', () => {
    const html = renderToStaticMarkup(
      <Card as="article" interactive className="extra">
        内容
      </Card>
    );

    expect(html).toContain('<article');
    expect(html).toContain('data-interactive="true"');
    expect(html).toContain('extra');
    expect(html).not.toContain('hover:-translate-y-1');
    expect(html).not.toContain('shadow-[var(--shadow-card-hover)]');
  });

  it('supports dashed and tinted variants from the component reference', () => {
    const html = renderToStaticMarkup(
      <>
        <Card variant="dashed">添加记录</Card>
        <Card variant="tinted" tint="pink">里程碑</Card>
      </>
    );

    expect(html).toContain('card-dashed');
    expect(html).toContain('data-variant="tinted"');
    expect(html).toContain('pink');
  });
});
