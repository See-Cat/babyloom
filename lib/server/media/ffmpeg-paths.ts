import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// The prebuilt `ffmpeg-static` / `ffprobe-static` binaries are glibc-linked and
// are not bundled into the Next.js standalone output, so they cannot run inside
// the Alpine (musl) container — every video upload then fails at probe/derive
// while images (sharp, with musl builds) work. The Docker image installs system
// ffmpeg/ffprobe and points to them via these env vars; local dev falls back to
// the static packages.
export const FFMPEG_PATH = process.env.FFMPEG_PATH || (ffmpegStatic as string);
export const FFPROBE_PATH = process.env.FFPROBE_PATH || ffprobeStatic.path;
