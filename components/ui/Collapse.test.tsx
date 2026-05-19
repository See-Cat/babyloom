import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Collapse } from './Collapse';

describe('Collapse', () => {
  it('renders expanded state with aria-hidden false', () => {
    const html = renderToStaticMarkup(<Collapse open>内容</Collapse>);

    expect(html).toContain('data-state="open"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('内容');
  });

  it('renders closed state', () => {
    const html = renderToStaticMarkup(<Collapse open={false}>内容</Collapse>);

    expect(html).toContain('data-state="closed"');
    expect(html).toContain('aria-hidden="true"');
  });
});
