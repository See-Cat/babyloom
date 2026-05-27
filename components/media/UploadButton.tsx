'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/client/hooks/useToast';

export interface UploadedMedia {
  mediaId: string;
  filename: string;
  status: 'ready' | 'pending';
  type?: 'photo' | 'video';
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
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFiles(files: FileList) {
    if (!requireOnline(toast)) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        warnIfHevc(file, toast);
        const type: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';
        const form = new FormData();
        form.append('babyId', babyId);
        form.append('clientUploadId', crypto.randomUUID());
        form.append('file', file);
        const res = await fetch('/api/media/upload', { method: 'POST', body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `upload_failed_${res.status}`);
        }
        const body = await res.json();
        if (body.status === 'pending' || body.status === 'processing') {
          onUploaded({ mediaId: body.mediaId, filename: file.name, status: 'pending', type });
          await pollUntilReady(body.mediaId);
        }
        onUploaded({ mediaId: body.mediaId, filename: file.name, status: 'ready', type });
      }
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
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
      {error && (
        <p role="alert" className="text-[length:var(--text-sm)] text-[color:var(--color-error)]">
          {error}
        </p>
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
