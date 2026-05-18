import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { AvatarDecodeError, AvatarTooLargeError, AvatarUnsupportedError, processAvatar } from './process';

describe('processAvatar', () => {
  it('returns a 256 square WebP for a valid image', async () => {
    const input = await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: '#336699'
      }
    })
      .jpeg()
      .toBuffer();

    const output = await processAvatar(input);
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });

  it('rejects unsupported image-like input', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await expect(processAvatar(svg)).rejects.toBeInstanceOf(AvatarUnsupportedError);
  });

  it('rejects oversized input before decoding', async () => {
    await expect(processAvatar(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(
      AvatarTooLargeError
    );
  });

  it('rejects corrupt image bytes with an image magic signature', async () => {
    const corruptJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9
    ]);
    await expect(processAvatar(corruptJpeg)).rejects.toBeInstanceOf(AvatarDecodeError);
  });
});
