import { loadConfig } from '@/lib/config/load';

export interface MediaLimits {
  maxPhotoBytes: number;
  maxVideoBytes: number;
}

let cached: { dataDir: string; limits: MediaLimits } | null = null;

export function getMediaLimits(dataDir: string): MediaLimits {
  if (cached?.dataDir === dataDir) return cached.limits;
  const cfg = loadConfig({ dataDir });
  const limits = {
    maxPhotoBytes: cfg.media.maxPhotoBytes,
    maxVideoBytes: cfg.media.maxVideoBytes
  };
  cached = { dataDir, limits };
  return limits;
}

export function resetMediaLimitsCacheForTesting(): void {
  cached = null;
}
