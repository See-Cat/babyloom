import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarGroup } from './Avatar';

describe('Avatar', () => {
  it('renders an image when src is present', () => {
    const html = renderToStaticMarkup(<Avatar src="/baby.png" alt="宝宝头像" name="宝宝" />);

    expect(html).toContain('<img');
    expect(html).toContain('alt="宝宝头像"');
  });

  it('falls back to the first Chinese character', () => {
    const html = renderToStaticMarkup(<Avatar name="小米" alt="小米" />);

    expect(html).toContain('小');
    expect(html).toContain('aria-label="小米"');
  });

  it('stacks avatars and shows overflow count', () => {
    const html = renderToStaticMarkup(
      <AvatarGroup
        avatars={[
          { name: 'Ava', alt: 'Ava' },
          { name: 'Ben', alt: 'Ben' },
          { name: 'Cat', alt: 'Cat' },
          { name: 'Dan', alt: 'Dan' }
        ]}
      />
    );

    expect(html).toContain('+1');
  });

  it('supports all reference sizes and stable palette colors', () => {
    const html = renderToStaticMarkup(
      <>
        <Avatar name="小米" size="xs" colorKey="baby-1" />
        <Avatar name="小米" size="xl" colorKey="baby-1" />
      </>
    );

    expect(html).toContain('data-size="xs"');
    expect(html).toContain('data-size="xl"');
    expect(html).toContain('ava-xs');
    expect(html).toContain('ava-xl');
    expect(html).toContain('ava-');
  });
});
