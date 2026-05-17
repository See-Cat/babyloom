'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/lib/hooks/useToast';

export type FormActionResult = { ok: true; message: string } | { ok: false; message: string };

export interface EditMeFormProps {
  initial: {
    name: string;
    username: string;
  };
  updateMyName: (name: string) => Promise<FormActionResult>;
  changeMyPassword: (input: { currentPassword: string; newPassword: string }) => Promise<FormActionResult>;
}

export function EditMeForm({ initial, updateMyName, changeMyPassword }: EditMeFormProps) {
  const toast = useToast();
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<'name' | 'password' | null>(null);

  async function onNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) {
      setNameError('请输入昵称');
      return;
    }
    setPending('name');
    const result = await updateMyName(name);
    setPending(null);
    if (result.ok) toast.show({ message: result.message, variant: 'success' });
    else setNameError(result.message);
  }

  async function onPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    const form = new FormData(event.currentTarget);
    const input = {
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword: String(form.get('newPassword') ?? ''),
      confirmNewPassword: String(form.get('confirmNewPassword') ?? '')
    };
    const error = validatePasswordInput(input);
    if (error) {
      setPasswordError(error);
      return;
    }
    setPending('password');
    const result = await changeMyPassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword
    });
    setPending(null);
    if (result.ok) {
      event.currentTarget.reset();
      toast.show({ message: result.message, variant: 'success' });
    } else {
      setPasswordError(result.message);
    }
  }

  return (
    <div className="grid gap-[var(--space-4)]">
      <Card as="section">
        <form aria-label="基本资料" className="grid gap-[var(--space-3)]" onSubmit={onNameSubmit}>
          <h2 className="text-[var(--text-lg)] font-bold text-[var(--color-fg-strong)]">基本资料</h2>
          <Input name="name" label="昵称" defaultValue={initial.name} error={nameError ?? undefined} />
          <Input name="username" label="用户名" defaultValue={initial.username} readOnly />
          <Button type="submit" disabled={pending === 'name'}>
            保存
          </Button>
        </form>
      </Card>

      <Card as="section">
        <form aria-label="修改密码" className="grid gap-[var(--space-3)]" onSubmit={onPasswordSubmit}>
          <h2 className="text-[var(--text-lg)] font-bold text-[var(--color-fg-strong)]">修改密码</h2>
          <Input name="currentPassword" label="当前密码" type="password" autoComplete="current-password" />
          <Input name="newPassword" label="新密码" type="password" autoComplete="new-password" />
          <Input name="confirmNewPassword" label="确认新密码" type="password" autoComplete="new-password" error={passwordError ?? undefined} />
          <Button type="submit" disabled={pending === 'password'}>
            更新密码
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function validatePasswordInput(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}) {
  if (!input.currentPassword) return '请输入当前密码';
  if (input.newPassword.length < 8) return '新密码至少 8 位';
  if (input.newPassword !== input.confirmNewPassword) return '两次输入的新密码不一致';
  return null;
}
