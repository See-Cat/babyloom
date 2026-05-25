import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BabyCard } from './BabyCard';

describe('BabyCard', () => {
  it('renders the active baby as a switchable record target card', () => {
    const html = renderToStaticMarkup(
      <BabyCard
        baby={{ id: 'baby-1', name: '小乐', birthday: '2024-01-01', gender: 'girl' }}
        active
        ageLabel="1岁3月"
        onSelect={() => undefined}
      />
    );

    expect(html).toContain('记录中');
    expect(html).toContain('1岁3月');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('<svg');
    expect(html).not.toContain('编辑');
    expect(html).not.toContain('删除');
  });
});
