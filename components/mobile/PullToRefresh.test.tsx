import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PullToRefresh } from './PullToRefresh';

describe('PullToRefresh', () => {
  it('renders children in a pull-to-refresh wrapper', () => {
    const html = renderToStaticMarkup(<PullToRefresh onRefresh={async () => undefined}>内容</PullToRefresh>);

    expect(html).toContain('bl-pull-to-refresh');
    expect(html).toContain('内容');
  });
});
