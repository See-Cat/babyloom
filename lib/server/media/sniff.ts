import { fileTypeFromFile } from 'file-type';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { FFPROBE_PATH } from './ffmpeg-paths';

ffmpeg.setFfprobePath(FFPROBE_PATH);

export class MediaUnsupportedError extends Error {
  code = 'unsupported_media' as const;
}

const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov'
};

export interface SniffResult {
  type: 'photo' | 'video';
  mimeType: string;
  ext: string;
  width: number;
  height: number;
  durationSec: number | null;
  takenAtMs: number | null;
}

export async function sniffAndValidate(absPath: string): Promise<SniffResult> {
  const ft = await fileTypeFromFile(absPath);
  if (!ft) throw new MediaUnsupportedError('no_magic_bytes');

  if (PHOTO_MIMES.has(ft.mime)) {
    const meta = await sharp(absPath, { failOn: 'error' }).metadata().catch(() => null);
    if (!meta?.width || !meta.height) throw new MediaUnsupportedError('photo_metadata_failed');
    return {
      type: 'photo',
      mimeType: ft.mime,
      ext: EXT_BY_MIME[ft.mime],
      width: meta.width,
      height: meta.height,
      durationSec: null,
      takenAtMs: readExifTakenAtMs(meta)
    };
  }

  if (VIDEO_MIMES.has(ft.mime)) {
    const probe = await probeVideo(absPath);
    return {
      type: 'video',
      mimeType: ft.mime,
      ext: EXT_BY_MIME[ft.mime],
      width: probe.width,
      height: probe.height,
      durationSec: Math.max(1, Math.round(probe.durationSec)),
      takenAtMs: null
    };
  }

  throw new MediaUnsupportedError(`mime_not_allowed:${ft.mime}`);
}

async function probeVideo(absPath: string): Promise<{
  width: number;
  height: number;
  durationSec: number;
}> {
  return await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(absPath, (err, data) => {
      if (err) {
        reject(new MediaUnsupportedError('video_probe_failed'));
        return;
      }
      const video = data.streams?.find((s) => s.codec_type === 'video');
      if (!video?.width || !video.height) {
        reject(new MediaUnsupportedError('video_no_video_stream'));
        return;
      }
      resolve({
        width: video.width,
        height: video.height,
        durationSec: Number(data.format?.duration ?? 0)
      });
    });
  });
}

function readExifTakenAtMs(meta: sharp.Metadata): number | null {
  if (!meta.exif) return null;
  const match = meta.exif
    .toString('latin1')
    .match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi, se] = match;
  const ts = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  return Number.isFinite(ts) ? ts : null;
}
