import { join, resolve, sep } from 'node:path';

export type Variant = 'original' | 'large' | 'thumb' | 'poster';

export function stagingDir(dataDir: string, uploadId: string): string {
  if (uploadId.includes('/') || uploadId.includes('\\') || uploadId.includes('..')) {
    throw new Error('invalid_upload_id');
  }
  return join(dataDir, 'media', '_staging', uploadId);
}

export function finalRelativePath(babyId: string, tsMs: number, mediaId: string): string {
  const d = new Date(tsMs);
  const year = String(d.getUTCFullYear());
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `media/${babyId}/${year}/${month}/${mediaId}`;
}

export function finalDirFromRelative(dataDir: string, relativePath: string): string {
  const abs = resolve(dataDir, relativePath);
  const rootAbs = resolve(dataDir, 'media');
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) {
    throw new Error('path_escape');
  }
  return abs;
}

export function variantFilename(variant: Variant, originalExt: string): string {
  return variant === 'original' ? `original.${originalExt}` : `${variant}.webp`;
}

export function resolveVariantPath(
  dataDir: string,
  relativePath: string,
  variant: Variant,
  originalExt: string
): string {
  return join(finalDirFromRelative(dataDir, relativePath), variantFilename(variant, originalExt));
}
