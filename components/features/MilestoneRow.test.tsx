import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MilestoneRow } from './MilestoneRow';

describe('MilestoneRow', () => {
  it('renders milestone names without schema emoji icons', () => {
    const html = renderToStaticMarkup(
      <MilestoneRow
        milestone={{
          id: 'first-step',
          name: '第一次走路',
          icon: '👣',
          isSystem: false
        }}
      />
    );

    expect(html).toContain('第一次走路');
    expect(html).not.toContain('👣');
  });
});
