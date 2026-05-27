import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Milestones admin UI', () => {
  it('uses app dialogs instead of native confirm for deletion', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/profile/milestones/MilestonesAdminClient.tsx'),
      'utf8'
    );

    expect(source).not.toContain('confirm(');
    expect(source).toContain('<Modal');
  });
});
