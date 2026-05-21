import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('renders a DateRow button instead of a native date input', () => {
    const html = renderToStaticMarkup(
      <DatePicker name="birthday" label="生日" value="2024-08-01" onChange={() => undefined} />
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('2024 年 8 月 1 日');
    expect(html).not.toContain('type="date"');
  });
});
