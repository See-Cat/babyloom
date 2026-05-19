import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { avatarFilePath, avatarPublicUrl } from './paths';

describe('avatar paths', () => {
  it('places user and baby avatars outside media storage', () => {
    expect(avatarFilePath('users', 'user-1', '/data')).toBe(
      join('/data', 'avatars', 'users', 'user-1.webp')
    );
    expect(avatarFilePath('babies', 'baby-1', '/data')).toBe(
      join('/data', 'avatars', 'babies', 'baby-1.webp')
    );
  });

  it('builds cache-busted public avatar URLs', () => {
    expect(avatarPublicUrl('users', 'user-1', 12345)).toBe(
      '/api/avatar/users/user-1.webp?v=12345'
    );
  });
});
