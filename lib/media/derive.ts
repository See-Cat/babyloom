import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import ffprobePath from 'ffprobe-static';
import { unlink } from 'fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

ffmpeg.setFfmpegPath(ffmpegPath as string);
ffmpeg.setFfprobePath(ffprobePath.path);

const LARGE_W = 1024;
const THUMB_W = 320;

export async function derivePhotoVariants(
  originalAbs: string,
  outDir: string
): Promise<{ large: string; thumb: string }> {
  const large = join(outDir, 'large.webp');
  const thumb = join(outDir, 'thumb.webp');
  await sharp(originalAbs)
    .rotate()
    .resize({ width: LARGE_W, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(large);
  await sharp(originalAbs)
    .rotate()
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(thumb);
  return { large, thumb };
}

export async function deriveVideoPoster(originalAbs: string, outDir: string): Promise<string> {
  const tmp = join(outDir, 'poster.jpg');
  const poster = join(outDir, 'poster.webp');
  await new Promise<void>((resolve, reject) => {
    ffmpeg(originalAbs)
      .frames(1)
      .outputOptions(['-q:v 4'])
      .output(tmp)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
  await sharp(tmp).resize({ width: LARGE_W, withoutEnlargement: true }).webp({ quality: 82 }).toFile(poster);
  await unlink(tmp).catch(() => {});
  return poster;
}
