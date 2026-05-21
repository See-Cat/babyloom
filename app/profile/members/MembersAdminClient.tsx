'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/mobile/AppShell';
import { FamilyMemberList } from '@/components/features/FamilyMemberList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

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
  const [resetFor, setResetFor] = useState<string | null>(null);
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

  async function createNew() {
    setError(null);
    const res = await fetch('/api/family-members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newMember)
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error === 'username_taken' ? '用户名已被占用' : '创建失败');
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
    if (!confirm('确定移除该成员? 该成员将无法登录。')) return;
    await fetch(`/api/family-members/${userId}`, { method: 'DELETE' });
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
      title="成员管理"
      leftSlot={
        <Link href="/profile" className="text-[var(--text-sm)] text-[var(--color-muted)]">
          返回
        </Link>
      }
    >

      {error && <p role="alert" className="mb-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-error)]">{error}</p>}

      <Link
        href="/profile/members/permissions"
        className="mb-[var(--space-4)] block rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-4)] font-semibold text-[var(--color-fg-strong)]"
      >
        宝宝权限
      </Link>

      <div className="mb-[var(--space-6)]">
        <FamilyMemberList
          members={members}
          onRoleChange={changeRole}
          onResetPassword={setResetFor}
          onRemove={remove}
          resetSlot={(m) =>
            resetFor === m.userId ? (
              <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-end">
                <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="新密码 (≥8 位)" label="新密码" />
                <Button type="button" size="sm" onClick={() => resetPwd(m.userId)}>
                  保存
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResetFor(null);
                    setResetPassword('');
                  }}
                >
                  取消
                </Button>
              </div>
            ) : null
          }
        />
      </div>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input label="用户名" placeholder="用户名 (3-50, a-z0-9_-)" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} />
          <Input label="昵称" placeholder="昵称" value={newMember.nickname} onChange={(e) => setNewMember({ ...newMember, nickname: e.target.value })} />
          <Input label="初始密码" type="password" placeholder="初始密码 (≥8)" value={newMember.password} onChange={(e) => setNewMember({ ...newMember, password: e.target.value })} />
          <select
            aria-label="角色"
            value={newMember.role}
            onChange={(e) =>
              setNewMember({ ...newMember, role: e.target.value as 'editor' | 'viewer' })
            }
            className="rounded-[var(--radius-pill)] border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-3)] py-[var(--space-2)]"
          >
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <div className="flex gap-[var(--space-2)]">
            <Button type="button" size="sm" onClick={createNew}>
              创建
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </Card>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setCreating(true)} fullWidth>
          + 添加成员
        </Button>
      )}
    </AppShell>
  );
}
