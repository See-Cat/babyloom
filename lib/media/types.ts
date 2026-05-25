export interface MediaItem {
  id: string;
  type?: 'photo' | 'video';
  durationSec?: number | null;
  filename?: string;
}
