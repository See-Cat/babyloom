import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

export class AvatarUnsupportedError extends Error {
  code = 'avatar_unsupported' as const;
}

export class AvatarTooLargeError extends Error {
  code = 'avatar_too_large' as const;
}

export class AvatarDecodeError extends Error {
  code = 'avatar_decode_failed' as const;
}

export async function processAvatar(buffer: Buffer): Promise<Buffer> {
  if (buffer.length > AVATAR_MAX_INPUT_BYTES) {
    throw new AvatarTooLargeError('avatar_too_large');
  }

  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || !SUPPORTED_MIMES.has(fileType.mime)) {
    throw new AvatarUnsupportedError('avatar_unsupported');
  }

  try {
    return await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize(256, 256, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new AvatarDecodeError('avatar_decode_failed');
  }
}
