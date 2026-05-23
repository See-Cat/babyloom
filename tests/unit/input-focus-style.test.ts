import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('input focus styles', () => {
  it('removes the global focus outline from reference input controls', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.input:focus-visible');
    expect(css).toContain('.textarea:focus-visible');
    expect(css).toContain('.date-row:focus-visible');
    expect(css).toMatch(/\.input:focus-visible[\s\S]*outline:\s*none/);
  });
});
