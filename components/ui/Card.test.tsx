import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children with the surface card class', () => {
    const html = renderToStaticMarkup(<Card>小记忆</Card>);

    expect(html).toContain('小记忆');
    expect(html).toContain('bl-card');
  });

  it('supports semantic element and interactive state', () => {
    const html = renderToStaticMarkup(
      <Card as="article" interactive className="extra">
        内容
      </Card>
    );

    expect(html).toContain('<article');
    expect(html).toContain('bl-card--interactive');
    expect(html).toContain('extra');
  });
});
