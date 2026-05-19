import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tag } from './Tag';

describe('Tag', () => {
  it('renders content and variant', () => {
    const html = renderToStaticMarkup(<Tag variant="accent">第一次翻身</Tag>);

    expect(html).toContain('第一次翻身');
    expect(html).toContain('data-variant="accent"');
  });

  it('renders an accessible remove button when removable', () => {
    const html = renderToStaticMarkup(
      <Tag removable onRemove={() => undefined}>
        待移除
      </Tag>
    );

    expect(html).toContain('button');
    expect(html).toContain('aria-label="移除"');
  });
});
