import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders an accessible loading indicator', () => {
    const html = renderToStaticMarkup(<Spinner />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="加载中"');
    expect(html).toContain('spinner spinner-md');
  });
});
