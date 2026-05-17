import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('links label and input id', () => {
    const html = renderToStaticMarkup(<Input id="baby-name" label="宝宝名字" name="name" />);

    expect(html).toContain('for="baby-name"');
    expect(html).toContain('id="baby-name"');
  });

  it('renders error message as a live alert', () => {
    const html = renderToStaticMarkup(<Input label="宝宝名字" error="必填" />);

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('必填');
  });
});
