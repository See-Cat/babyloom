import { variantFilename, type Variant } from './paths';

export class OutputBadRequestError extends Error {
  code = 'bad_size' as const;
}

export interface MediaForOutput {
  id: string;
  type: 'photo' | 'video';
  mimeType: string;
  originalExt: string;
  filename: string;
}

export interface OutputDescriptor {
  variant: Variant;
  variantFile: string;
  contentType: string;
  contentDisposition: string;
}

const ALLOWED: ReadonlyArray<Variant> = ['original', 'large', 'thumb', 'poster'];

export function resolveOutputVariant(row: MediaForOutput, rawSize: string): OutputDescriptor {
  if (!(ALLOWED as readonly string[]).includes(rawSize)) {
    throw new OutputBadRequestError('illegal_size');
  }

  let variant = rawSize as Variant;
  if (row.type === 'photo' && variant === 'poster') {
    throw new OutputBadRequestError('photo_has_no_poster');
  }
  if (row.type === 'video' && (variant === 'thumb' || variant === 'large')) {
    variant = 'poster';
  }

  const variantFile = variantFilename(variant, row.originalExt);
  const baseFilename = sanitizeForHeader(row.filename);
  if (variant === 'original') {
    return {
      variant,
      variantFile,
      contentType: row.mimeType,
      contentDisposition: `attachment; filename*=UTF-8''${rfc5987Encode(baseFilename)}`
    };
  }

  return {
    variant,
    variantFile,
    contentType: 'image/webp',
    contentDisposition: `inline; filename*=UTF-8''${rfc5987Encode(`${baseFilename}.webp`)}`
  };
}

function sanitizeForHeader(s: string): string {
  return s.replace(/[\x00-\x1f\x7f"\\]/g, '_').slice(0, 200) || 'media';
}

function rfc5987Encode(s: string): string {
  return encodeURIComponent(s).replace(/['()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
