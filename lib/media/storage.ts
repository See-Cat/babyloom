import { mkdir, rename, rm } from 'fs/promises';
import { join } from 'node:path';
import { finalDirFromRelative, finalRelativePath, stagingDir, variantFilename } from './paths';

export interface StagingHandle {
  stagingDir: string;
  rawPath: string;
}

export async function prepareStaging(dataDir: string, uploadId: string): Promise<StagingHandle> {
  const dir = stagingDir(dataDir, uploadId);
  await mkdir(dir, { recursive: true });
  return { stagingDir: dir, rawPath: join(dir, 'raw.bin') };
}

export interface CommitOpts {
  mediaId: string;
  babyId: string;
  createdAtMs: number;
  ext: string;
  kind: 'photo' | 'video';
}

export async function commitStaging(dataDir: string, opts: CommitOpts): Promise<string> {
  const rel = finalRelativePath(opts.babyId, opts.createdAtMs, opts.mediaId);
  const finalDir = finalDirFromRelative(dataDir, rel);
  await mkdir(finalDir, { recursive: true });

  const stage = stagingDir(dataDir, opts.mediaId);
  const moves: Array<[string, string]> = [
    [join(stage, variantFilename('original', opts.ext)), join(finalDir, variantFilename('original', opts.ext))]
  ];
  if (opts.kind === 'photo') {
    moves.push([join(stage, 'large.webp'), join(finalDir, 'large.webp')]);
    moves.push([join(stage, 'thumb.webp'), join(finalDir, 'thumb.webp')]);
  } else {
    moves.push([join(stage, 'poster.webp'), join(finalDir, 'poster.webp')]);
  }

  for (const [from, to] of moves) {
    await rename(from, to);
  }
  await rm(stage, { recursive: true, force: true });
  return rel;
}

export async function purgeStagingDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function purgeFinalDir(dataDir: string, relativePath: string): Promise<void> {
  await rm(finalDirFromRelative(dataDir, relativePath), { recursive: true, force: true });
}
