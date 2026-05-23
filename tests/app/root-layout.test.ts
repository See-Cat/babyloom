import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RootLayout', () => {
  it('allows browser extensions to add root html attributes before hydration', () => {
    const source = readFileSync(resolve(__dirname, '../../app/layout.tsx'), 'utf8');

    expect(source).toContain('<html lang="zh" suppressHydrationWarning>');
  });
});
