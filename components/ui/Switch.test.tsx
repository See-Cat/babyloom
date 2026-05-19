import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders switch semantics and checked state', () => {
    const html = renderToStaticMarkup(<Switch checked aria-label="启用" onCheckedChange={() => undefined} />);

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('data-state="checked"');
  });

  it('renders unchecked state', () => {
    const html = renderToStaticMarkup(<Switch checked={false} aria-label="启用" onCheckedChange={() => undefined} />);

    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('data-state="unchecked"');
  });
});
