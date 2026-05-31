'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { requireOnline } from '@/lib/client/require-online';
import { useToast } from '@/lib/client/hooks/useToast';

export type FormActionResult = { ok: true; message: string } | { ok: false; message: string };

export interface EditMeFormProps {
  initial: {
    name: string;
    image: string | null;
  };
  username: string;
  target: 'me' | `baby:${string}`;
  updateMyName: (name: string) => Promise<FormActionResult>;
}

export function EditMeForm({ initial, username, target, updateMyName }: EditMeFormProps) {
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = React.useState(initial.name);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayUrl = pendingFile ? previewUrl : pendingDelete ? null : initial.image;
  const dirty = name.trim() !== initial.name || pendingFile !== null || pendingDelete;

  function pickFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file) {
      setPendingFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPendingDelete(false);
    } else {
      setPendingFile(null);
      setPreviewUrl(null);
    }
  }

  function onRemoveAvatar() {
    if (pendingFile) {
      pickFile(null);
      return;
    }
    if (initial.image) setPendingDelete(true);
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireOnline(toast)) return;
    setNameError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('请输入昵称');
      return;
    }

    setSaving(true);
    try {
      if (pendingFile) {
        const form = new FormData();
        form.set('target', target);
        form.set('file', pendingFile);
        const res = await fetch('/api/avatar', { method: 'POST', body: form });
        if (!res.ok) {
          toast.show({ message: '头像上传失败', variant: 'error' });
          return;
        }
      } else if (pendingDelete) {
        const res = await fetch(`/api/avatar?target=${encodeURIComponent(target)}`, { method: 'DELETE' });
        if (!res.ok) {
          toast.show({ message: '删除头像失败', variant: 'error' });
          return;
        }
      }

      if (trimmed !== initial.name) {
        const result = await updateMyName(trimmed);
        if (!result.ok) {
          setNameError(result.message);
          return;
        }
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingFile(null);
      setPreviewUrl(null);
      setPendingDelete(false);
      toast.show({ message: '已保存', variant: 'success' });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section">
      <form aria-label="我的资料" onSubmit={onSave} className="grid gap-[var(--space-4)]">
        <div className="flex flex-col items-center gap-[var(--space-2)]">
          <AvatarUpload
            name={initial.name}
            src={displayUrl}
            onPick={(file) => pickFile(file)}
            onRemove={onRemoveAvatar}
            onBeforePick={() => requireOnline(toast)}
          />
        </div>

        <div className="grid gap-[var(--space-3)]">
          <Input name="username" label="用户名" defaultValue={username} readOnly />
          <Input
            name="name"
            label="昵称"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={nameError ?? undefined}
          />
        </div>

        <Button type="submit" disabled={saving || !dirty} loading={saving}>
          保存
        </Button>
      </form>
    </Card>
  );
}
