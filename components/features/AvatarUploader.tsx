'use client';

import * as React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/hooks/useToast';

export interface AvatarUploaderProps {
  currentUrl?: string | null;
  fallbackName: string;
  target: 'me' | `baby:${string}`;
}

export function AvatarUploader({ currentUrl, fallbackName, target }: AvatarUploaderProps) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState(currentUrl ?? null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    setAvatarUrl(currentUrl ?? null);
  }, [currentUrl]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPick(nextFile: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
  }

  async function upload() {
    if (!requireOnline(toast)) return;
    if (!file) {
      inputRef.current?.click();
      return;
    }

    const form = new FormData();
    form.set('target', target);
    form.set('file', file);
    setUploading(true);
    const res = await fetch('/api/avatar', { method: 'POST', body: form });
    setUploading(false);
    if (!res.ok) {
      toast.show({ message: '头像上传失败', variant: 'error' });
      return;
    }
    const body = await res.json();
    setAvatarUrl(body.url);
    onPick(null);
    toast.show({ message: '头像已更新', variant: 'success' });
  }

  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <Avatar src={previewUrl ?? avatarUrl ?? undefined} name={fallbackName} size="lg" />
      <div className="flex flex-wrap gap-[var(--space-2)]">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => onPick(event.currentTarget.files?.[0] ?? null)}
        />
        <Button type="button" size="sm" variant="secondary" onClick={() => requireOnline(toast) && inputRef.current?.click()}>
          更换头像
        </Button>
        {file && (
          <Button type="button" size="sm" loading={uploading} onClick={upload}>
            上传头像
          </Button>
        )}
      </div>
    </div>
  );
}
