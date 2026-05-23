import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('service worker', () => {
  it('explicitly disables navigation preload for existing registrations', () => {
    const source = readFileSync(resolve(__dirname, '../../app/sw.ts'), 'utf8');

    expect(source).toContain('disableNavigationPreload');
    expect(source).toContain('disableNavigationPreload();');
  });
});
