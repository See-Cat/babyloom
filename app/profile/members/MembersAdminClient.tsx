'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { AppShell } from '@/components/mobile/AppShell';
import { FamilyMemberList, type FamilyMemberListItem } from '@/components/features/FamilyMemberList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ChevronLeftIcon, PlusIcon } from '@/components/ui/icons';

interface Member {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
}

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({
    username: '',
    password: '',
    nickname: '',
    role: 'editor' as 'editor' | 'viewer'
  });
  const [activeMember, setActiveMember] = useState<FamilyMemberListItem | null>(null);
  const [resetFor, setResetFor] = useState<FamilyMemberListItem | null>(null);
  const [removeFor, setRemoveFor] = useState<FamilyMemberListItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch('/api/family-members');
    if (!res.ok) return;
    const body = await res.json();
    setMembers(body.members);
  }

  useEffect(() => {
    reload();
  }, []);

  function validateNewMember(): string | null {
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(newMember.username)) return '用户名需 3-50 位，仅支持英文、数字、_ 和 -';
    if (!newMember.nickname.trim()) return '请填写昵称';
    if (newMember.password.length < 8) return '初始密码至少 8 位';
    return null;
  }

  async function createNew() {
    setError(null);
    const validationError = validateNewMember();
    if (validationError) {
      setError(validationError);
      return;
    }
    const res = await fetch('/api/family-members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newMember)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error === 'username_taken' ? '用户名已被占用' : '创建失败，请检查输入');
      return;
    }
    setCreating(false);
    setNewMember({ username: '', password: '', nickname: '', role: 'editor' });
    reload();
  }

  async function changeRole(userId: string, role: 'editor' | 'viewer') {
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role })
    });
    reload();
  }

  async function remove(userId: string) {
    await fetch(`/api/family-members/${userId}`, { method: 'DELETE' });
    setRemoveFor(null);
    reload();
  }

  async function resetPwd(userId: string) {
    if (!resetPassword || resetPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: resetPassword })
    });
    setResetFor(null);
    setResetPassword('');
    setError(null);
  }

  return (
    <AppShell
      title="家庭成员"
      leftSlot={
        <Link
          href="/profile"
          aria-label="返回"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5"
        >
          <ChevronLeftIcon />
        </Link>
      }
    >

      {error && <p role="alert" className="mb-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-error)]">{error}</p>}

      <Link
        href="/profile/members/permissions"
        className="mb-[var(--space-4)] block rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-4)] font-semibold text-[color:var(--color-fg-strong)]"
      >
        宝宝权限
      </Link>

      <div className="mb-[var(--space-6)]">
        <FamilyMemberList
          members={members}
          onSelect={setActiveMember}
        />
      </div>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input label="用户名" placeholder="用户名 (3-50, a-z0-9_-)" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} />
          <Input label="昵称" placeholder="昵称" value={newMember.nickname} onChange={(e) => setNewMember({ ...newMember, nickname: e.target.value })} />
          <PasswordInput
            label="初始密码"
            placeholder="初始密码 (≥8)"
            value={newMember.password}
            onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
          />
          <SegmentedControl
            ariaLabel="角色"
            value={newMember.role}
            onChange={(value) => setNewMember({ ...newMember, role: value as 'editor' | 'viewer' })}
            className="grid-cols-2"
            options={[
              { value: 'editor', label: '可编辑' },
              { value: 'viewer', label: '仅查看' }
            ]}
          />
          <div className="mt-[var(--space-1)] grid grid-cols-2 gap-[var(--space-2)]">
            <Button type="button" size="md" onClick={createNew} fullWidth>
              创建
            </Button>
            <Button type="button" size="md" variant="default" onClick={() => setCreating(false)} fullWidth>
              取消
            </Button>
          </div>
        </Card>
      ) : (
        <Button type="button" variant="secondary" leadingIcon={<PlusIcon />} onClick={() => setCreating(true)} fullWidth>
          添加成员
        </Button>
      )}
      {activeMember && (
        <ActionSheet
          open={Boolean(activeMember)}
          onOpenChange={(open) => {
            if (!open) setActiveMember(null);
          }}
          title={`${activeMember.nickname} · @${activeMember.username}`}
          options={[
            {
              label: '重置密码',
              onSelect: () => setResetFor(activeMember)
            },
            {
              label: activeMember.role === 'editor' ? '切换为「仅查看」' : '切换为「可编辑」',
              onSelect: () => changeRole(activeMember.userId, activeMember.role === 'editor' ? 'viewer' : 'editor')
            },
            {
              label: '移除成员',
              destructive: true,
              onSelect: () => setRemoveFor(activeMember)
            }
          ]}
        />
      )}
      <Dialog
        open={Boolean(resetFor)}
        onOpenChange={(open) => {
          if (!open) {
            setResetFor(null);
            setResetPassword('');
          }
        }}
        title="重置密码"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setResetFor(null)}>
              取消
            </Button>
            <Button type="button" onClick={() => resetFor && resetPwd(resetFor.userId)}>
              保存
            </Button>
          </>
        }
      >
        <PasswordInput
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          placeholder="新密码 (至少 8 位)"
          label="新密码"
        />
      </Dialog>
      <Dialog
        open={Boolean(removeFor)}
        onOpenChange={(open) => {
          if (!open) setRemoveFor(null);
        }}
        title="移除成员"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRemoveFor(null)}>
              取消
            </Button>
            <Button type="button" variant="error" onClick={() => removeFor && remove(removeFor.userId)}>
              移除
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          确认移除 {removeFor?.nickname ?? '该成员'}? 该成员将无法登录,但他们已记录的内容会保留。
        </p>
      </Dialog>
    </AppShell>
  );
}
