'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/client/hooks/useToast';

export interface UploadedMedia {
  /** Stable client-side id; also sent as clientUploadId. Survives pending→ready/failed. */
  uploadId: string;
  /** Server media id, present once the upload is ready. */
  mediaId?: string;
  filename: string;
  status: 'pending' | 'ready' | 'failed';
  type?: 'photo' | 'video';
}

// How many files upload in parallel. Each one drives server-side sharp/ffmpeg
// work on the (often modest) host, so keep this small to avoid thrashing.
// The limiter is module-global: no matter how many batches/components are
// uploading at once, at most this many requests are in flight together.
const UPLOAD_CONCURRENCY = 4;

let activeUploads = 0;
const uploadWaiters: Array<() => void> = [];

function acquireUploadSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeUploads < UPLOAD_CONCURRENCY) {
      activeUploads += 1;
      resolve();
    } else {
      uploadWaiters.push(resolve);
    }
  });
}

function releaseUploadSlot(): void {
  const next = uploadWaiters.shift();
  if (next) {
    next(); // hand the slot to the next waiter (active count unchanged)
  } else {
    activeUploads -= 1;
  }
}

export interface UploadButtonProps {
  babyId: string;
  onUploaded: (media: UploadedMedia) => void;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  renderTrigger?: (args: { click: () => void; busy: boolean }) => React.ReactNode;
}

export function UploadButton({ babyId, onUploaded, disabled, multiple = true, className, renderTrigger }: UploadButtonProps) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Count overlapping batches so "busy" stays true while any are in flight,
  // even when the user keeps adding more files mid-upload.
  const [activeBatches, setActiveBatches] = React.useState(0);
  const busy = activeBatches > 0;

  async function uploadOne(file: File) {
    const uploadId = crypto.randomUUID();
    const type: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';
    warnIfHevc(file, toast);
    // Emit a placeholder immediately so the UI shows this file as "in progress".
    onUploaded({ uploadId, filename: file.name, status: 'pending', type });
    try {
      const form = new FormData();
      form.append('babyId', babyId);
      form.append('clientUploadId', uploadId);
      form.append('file', file);
      const res = await fetch('/api/media/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `upload_failed_${res.status}`);
      }
      const body = await res.json();
      if (body.status === 'pending' || body.status === 'processing') {
        await pollUntilReady(body.mediaId);
      }
      onUploaded({ uploadId, mediaId: body.mediaId, filename: file.name, status: 'ready', type });
    } catch {
      onUploaded({ uploadId, filename: file.name, status: 'failed', type });
    }
  }

  async function handleFiles(files: FileList) {
    if (!requireOnline(toast)) return;
    const list = Array.from(files);
    if (inputRef.current) inputRef.current.value = ''; // allow re-selecting while this batch runs
    setActiveBatches((n) => n + 1);
    try {
      await Promise.all(
        list.map(async (file) => {
          await acquireUploadSlot();
          try {
            await uploadOne(file);
          } finally {
            releaseUploadSlot();
          }
        })
      );
    } finally {
      setActiveBatches((n) => n - 1);
    }
  }

  function click() {
    if (requireOnline(toast)) inputRef.current?.click();
  }

  return (
    <div className={className ?? 'flex flex-col gap-2'}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
        multiple={multiple}
        hidden
        onChange={(event) => event.target.files && handleFiles(event.target.files)}
      />
      {renderTrigger ? (
        renderTrigger({ click, busy })
      ) : (
        <Button type="button" size="sm" variant="secondary" disabled={disabled || busy} onClick={click}>
          {busy ? '上传中…' : '添加照片 / 视频'}
        </Button>
      )}
    </div>
  );
}

function warnIfHevc(file: File, toast: ReturnType<typeof useToast>) {
  const name = file.name.toLowerCase();
  if (file.type !== 'video/quicktime' && !name.endsWith('.mov') && !name.endsWith('.hevc') && !name.endsWith('.h265')) {
    return;
  }
  toast.show({
    message: 'iOS 拍摄的 HEVC 视频在部分浏览器无法播放。如需在所有设备上观看,建议先转码为 H.264。'
  });
}

async function pollUntilReady(mediaId: string): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const res = await fetch(`/api/media/${mediaId}/status`);
    if (!res.ok) throw new Error('状态获取失败');
    const body = await res.json();
    if (body.status === 'ready') return;
    if (body.status === 'failed') throw new Error('处理失败');
  }
  throw new Error('上传超时');
}
