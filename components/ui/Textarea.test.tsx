import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('links label and textarea id', () => {
    const html = renderToStaticMarkup(<Textarea id="content" label="记录内容" name="content" />);

    expect(html).toContain('for="content"');
    expect(html).toContain('id="content"');
    expect(html).toContain('记录内容');
    expect(html).toContain('class="field');
    expect(html).toContain('class="textarea');
  });

  it('renders error message as a live alert', () => {
    const html = renderToStaticMarkup(<Textarea label="记录内容" error="请输入内容" />);

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('input-error-msg');
  });
});
