'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DatePicker, nowDatePickerValue } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CameraIcon } from '@/components/ui/icons';
import { useToast } from '@/lib/client/hooks/useToast';

export interface BabyEditSaved {
  id: string;
  name: string;
  image: string | null;
}

interface BabyEditSheetProps {
  babyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (next: BabyEditSaved) => void;
}

export function BabyEditSheet({ babyId, open, onOpenChange, onSaved }: BabyEditSheetProps) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', birthday: '', gender: 'girl' });
  const [savedAvatarUrl, setSavedAvatarUrl] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setAvatarFile(null);
    setRemoveAvatar(false);
    fetch(`/api/babies/${babyId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load_failed'))))
      .then((data) => {
        if (cancelled) return;
        setForm({ name: data.name ?? '', birthday: data.birthday ?? '', gender: data.gender ?? 'girl' });
        setSavedAvatarUrl(data.avatarUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) toast.show({ message: '加载失败', variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, babyId, toast]);

  React.useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const shownAvatar = avatarFile ? previewUrl : removeAvatar ? null : savedAvatarUrl;

  async function onSave() {
    if (!form.name.trim() || !form.birthday) {
      toast.show({ message: '请填写名字和生日', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/babies/${babyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), birthday: form.birthday, gender: form.gender })
      });
      if (!res.ok) {
        toast.show({ message: '保存失败,请检查输入', variant: 'error' });
        return;
      }

      let nextAvatar = savedAvatarUrl;
      if (avatarFile) {
        const fd = new FormData();
        fd.set('target', `baby:${babyId}`);
        fd.set('file', avatarFile);
        const ar = await fetch('/api/avatar', { method: 'POST', body: fd });
        if (!ar.ok) {
          toast.show({ message: '头像上传失败', variant: 'error' });
          return;
        }
        nextAvatar = (await ar.json())?.url ?? null;
      } else if (removeAvatar && savedAvatarUrl) {
        const dr = await fetch(`/api/avatar?target=baby:${babyId}`, { method: 'DELETE' });
        if (!dr.ok) {
          toast.show({ message: '移除头像失败', variant: 'error' });
          return;
        }
        nextAvatar = null;
      }

      onSaved({ id: babyId, name: form.name.trim(), image: nextAvatar });
      onOpenChange(false);
      router.refresh();
      toast.show({ message: '已保存', variant: 'success' });
    } catch {
      toast.show({ message: '保存失败', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      dismissible={!saving}
      title="编辑宝宝"
      footer={
        <>
          <Button type="button" variant="default" disabled={saving} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={saving || loading} loading={saving} onClick={onSave}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="py-[var(--space-6)] text-center text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">加载中…</p>
      ) : (
        <div className="flex flex-col gap-[var(--space-4)] pb-[var(--space-5)]">
          <div className="flex flex-col items-center gap-[var(--space-2)]">
            <button
              type="button"
              aria-label="选择头像"
              onClick={() => fileRef.current?.click()}
              className="relative inline-flex h-[88px] w-[88px] items-center justify-center rounded-full focus-visible:outline-[3px] focus-visible:outline-[color:var(--color-focus)]"
            >
              <Avatar src={shownAvatar ?? undefined} name={form.name || '宝宝'} colorKey={babyId} size="xl" />
              <span
                aria-hidden="true"
                className="absolute -bottom-[2px] -right-[2px] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)] ring-[3px] ring-[var(--color-bg)]"
              >
                <CameraIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                setAvatarFile(event.currentTarget.files?.[0] ?? null);
                setRemoveAvatar(false);
              }}
            />
            {shownAvatar && (
              <button
                type="button"
                onClick={() => {
                  setAvatarFile(null);
                  setRemoveAvatar(true);
                }}
                className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-error-active)]"
              >
                移除头像
              </button>
            )}
          </div>
          <Input
            name="name"
            required
            label="名字"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <DatePicker
            name="birthday"
            required
            mode="datetime"
            label="生日"
            value={form.birthday}
            maxValue={nowDatePickerValue('datetime')}
            onChange={(birthday) => setForm({ ...form, birthday })}
          />
          <div className="flex flex-col gap-1 text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg)]">
            <span>性别</span>
            <SegmentedControl
              ariaLabel="性别"
              value={form.gender}
              onChange={(gender) => setForm({ ...form, gender })}
              className="grid-cols-2"
              options={[
                { value: 'boy', label: '男宝' },
                { value: 'girl', label: '女宝' }
              ]}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
