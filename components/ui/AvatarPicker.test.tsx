import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AvatarPicker } from './AvatarPicker';

describe('AvatarPicker', () => {
  it('renders an optional 88px avatar control with camera affordance', () => {
    const html = renderToStaticMarkup(
      <AvatarPicker name="小米" colorKey="baby-1" hint="头像可选 · 不上传时自动用昵称首字" />
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="设置头像"');
    expect(html).toContain('avatar-pick');
    expect(html).toContain('ava-big');
    expect(html).toContain('class="cam"');
    expect(html).toContain('头像可选');
  });
});
