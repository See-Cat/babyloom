import { join } from 'node:path';

export type AvatarKind = 'users' | 'babies';

export function avatarFilePath(kind: AvatarKind, id: string, dataDir: string) {
  return join(dataDir, 'avatars', kind, `${id}.webp`);
}

export function avatarPublicUrl(kind: AvatarKind, id: string, mtime: number) {
  return `/api/avatar/${kind}/${id}.webp?v=${mtime}`;
}
