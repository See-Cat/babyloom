import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureUploadDir } from './upload-path.util';

describe('ensureUploadDir', () => {
  it('creates nested upload directories before multer writes files', () => {
    const root = join(tmpdir(), `babyloom-upload-test-${Date.now()}`);
    const target = join(root, 'baby-1', '2026', '05');

    ensureUploadDir(target);

    expect(existsSync(target)).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });
});
