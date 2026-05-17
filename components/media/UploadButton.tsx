'use client';

import * as React from 'react';

export interface UploadedMedia {
  mediaId: string;
  filename: string;
  status: 'ready' | 'pending';
}

export interface UploadButtonProps {
  babyId: string;
  onUploaded: (media: UploadedMedia) => void;
  disabled?: boolean;
  multiple?: boolean;
}

export function UploadButton({ babyId, onUploaded, disabled, multiple = true }: UploadButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
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
          onUploaded({ mediaId: body.mediaId, filename: file.name, status: 'pending' });
          await pollUntilReady(body.mediaId);
        }
        onUploaded({ mediaId: body.mediaId, filename: file.name, status: 'ready' });
      }
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
        multiple={multiple}
        hidden
        onChange={(event) => event.target.files && handleFiles(event.target.files)}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="self-start border rounded px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy ? '上传中…' : '添加照片 / 视频'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
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
