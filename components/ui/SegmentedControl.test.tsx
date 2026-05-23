import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('renders options without native select markup', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        ariaLabel="角色"
        value="editor"
        onChange={() => undefined}
        options={[
          { value: 'editor', label: 'editor' },
          { value: 'viewer', label: 'viewer' }
        ]}
      />
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('segmented');
    expect(html).toContain('seg active');
    expect(html).not.toContain('<select');
  });
});
