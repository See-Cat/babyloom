'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { AppShell } from '@/components/mobile/AppShell';
import {
  FamilyMemberList,
  type FamilyMemberBabyPermission,
  type FamilyMemberListItem
} from '@/components/features/FamilyMemberList';
import {
  BabyAssociationSheet,
  type BabyOption
} from '@/components/features/BabyAssociationSheet';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ChevronLeftIcon, PlusIcon } from '@/components/ui/icons';

interface InitialBaby {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ApiMember {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: number;
  babyPermissions: FamilyMemberBabyPermission[];
}

export default function MembersAdminPage({
  initialBabies
}: {
  initialBabies: InitialBaby[];
}) {
  const [members, setMembers] = useState<ApiMember[]>([]);
  const babies = initialBabies;
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({ username: '', password: '', nickname: '' });
  const [newAssocBabyIds, setNewAssocBabyIds] = useState<Set<string>>(
    new Set(initialBabies.length === 1 ? [initialBabies[0].id] : [])
  );
  const [newAssocPermission, setNewAssocPermission] = useState<'viewer' | 'editor'>('editor');
  const [activeMember, setActiveMember] = useState<FamilyMemberListItem | null>(null);
  const [resetFor, setResetFor] = useState<FamilyMemberListItem | null>(null);
  const [removeFor, setRemoveFor] = useState<FamilyMemberListItem | null>(null);
  const [assocFor, setAssocFor] = useState<FamilyMemberListItem | null>(null);
  const [editingAssoc, setEditingAssoc] = useState<{
    member: FamilyMemberListItem;
    perm: FamilyMemberBabyPermission;
  } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch('/api/family-members');
    if (!res.ok) return;
    const body = await res.json();
    setMembers((body.members as ApiMember[]).filter((m) => m.role !== 'owner'));
  }

  useEffect(() => {
    reload();
  }, []);

  function validateNewMember(): string | null {
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(newMember.username))
      return '用户名需 3-50 位，仅支持英文、数字、_ 和 -';
    if (!newMember.nickname.trim()) return '请填写昵称';
    if (newMember.password.length < 8) return '初始密码至少 8 位';
    return null;
  }

  async function createNew() {
    setError(null);
    const v = validateNewMember();
    if (v) {
      setError(v);
      return;
    }
    const payload: Record<string, unknown> = {
      username: newMember.username,
      password: newMember.password,
      nickname: newMember.nickname
    };
    if (newAssocBabyIds.size > 0) {
      payload.babyAssociations = {
        babyIds: Array.from(newAssocBabyIds),
        permission: newAssocPermission
      };
    }
    const res = await fetch('/api/family-members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === 'username_taken' ? '用户名已被占用' : '创建失败，请检查输入'
      );
      return;
    }
    setCreating(false);
    setNewMember({ username: '', password: '', nickname: '' });
    setNewAssocBabyIds(new Set(babies.length === 1 ? [babies[0].id] : []));
    setNewAssocPermission('editor');
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

  async function changeAssoc(
    memberId: string,
    babyId: string,
    permission: 'viewer' | 'editor'
  ) {
    await fetch(`/api/family-members/${memberId}/baby-permissions/${babyId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permission })
    });
    setEditingAssoc(null);
    reload();
  }

  async function removeAssoc(memberId: string, babyId: string) {
    await fetch(`/api/family-members/${memberId}/baby-permissions/${babyId}`, {
      method: 'DELETE'
    });
    setEditingAssoc(null);
    reload();
  }

  async function addAssocs(
    memberId: string,
    babyIds: string[],
    permission: 'viewer' | 'editor'
  ) {
    if (babyIds.length === 0) {
      setAssocFor(null);
      return;
    }
    await fetch(`/api/family-members/${memberId}/baby-permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ babyIds, permission })
    });
    setAssocFor(null);
    reload();
  }

  const listItems: FamilyMemberListItem[] = members.map((m) => ({
    memberId: m.memberId,
    userId: m.userId,
    username: m.username,
    nickname: m.nickname,
    role: m.role,
    babyPermissions: m.babyPermissions
  }));

  function disabledReason(item: FamilyMemberListItem): string | null {
    if (babies.length === 0) return '请先在「宝宝管理」中添加宝宝';
    if (item.babyPermissions.length >= babies.length) return '已关联全部宝宝';
    return null;
  }

  function availableBabiesFor(item: FamilyMemberListItem): BabyOption[] {
    const taken = new Set(item.babyPermissions.map((p) => p.babyId));
    return babies
      .filter((b) => !taken.has(b.id))
      .map((b) => ({ id: b.id, name: b.name, avatarUrl: b.avatarUrl }));
  }

  return (
    <AppShell
      title="成员管理"
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
      {error && (
        <p
          role="alert"
          className="mb-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-error)]"
        >
          {error}
        </p>
      )}

      {listItems.length === 0 && !creating && (
        <Card className="mb-[var(--space-4)] text-center text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">
          还没有家人加入
        </Card>
      )}

      <div className="mb-[var(--space-6)]">
        <FamilyMemberList
          members={listItems}
          onMemberAction={setActiveMember}
          onAssociationClick={(member, perm) => setEditingAssoc({ member, perm })}
          onAddAssociation={setAssocFor}
          canAddDisabledReason={disabledReason}
          isAddHidden={(item) => babies.length > 0 && item.babyPermissions.length >= babies.length}
        />
      </div>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input
            label="用户名"
            placeholder="用户名 (3-50, a-z0-9_-)"
            value={newMember.username}
            onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
          />
          <Input
            label="昵称"
            placeholder="昵称"
            value={newMember.nickname}
            onChange={(e) => setNewMember({ ...newMember, nickname: e.target.value })}
          />
          <PasswordInput
            label="初始密码"
            placeholder="初始密码 (≥8)"
            value={newMember.password}
            onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
          />
          {babies.length > 0 && (
            <fieldset className="flex flex-col gap-[var(--space-3)]">
              <legend className="mb-[var(--space-2)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)]">
                关联宝宝（可跳过）
              </legend>
              <div className="grid grid-cols-3 gap-[var(--space-3)]">
                {babies.map((b) => {
                  const selected = newAssocBabyIds.has(b.id);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      aria-pressed={selected}
                      onClick={() => {
                        const next = new Set(newAssocBabyIds);
                        if (next.has(b.id)) next.delete(b.id);
                        else next.add(b.id);
                        setNewAssocBabyIds(next);
                      }}
                      className={cn(
                        'relative flex flex-col items-center gap-[var(--space-2)] rounded-[var(--radius-card)] border-2 px-[var(--space-2)] py-[var(--space-3)] transition-transform duration-100 active:scale-[0.97]',
                        selected
                          ? 'border-[color:var(--color-primary)] bg-[var(--color-primary-bg)]'
                          : 'border-[var(--color-border-light)] bg-[var(--color-surface-2)]'
                      )}
                    >
                      <Avatar
                        src={b.avatarUrl ?? undefined}
                        name={b.name}
                        colorKey={b.id}
                        size="lg"
                      />
                      <span
                        className={cn(
                          'max-w-full truncate text-[length:var(--text-sm)] font-bold',
                          selected
                            ? 'text-[color:var(--color-primary-active)]'
                            : 'text-[color:var(--color-fg-strong)]'
                        )}
                      >
                        {b.name}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'absolute -right-[6px] -top-[6px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-surface-2)] text-[11px] font-black transition-all duration-150',
                          selected
                            ? 'scale-100 bg-[var(--color-primary)] text-white'
                            : 'scale-0 bg-transparent text-transparent'
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
              {newAssocBabyIds.size > 0 && (
                <div>
                  <p className="mb-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)]">
                    权限
                  </p>
                  <SegmentedControl
                    ariaLabel="权限"
                    value={newAssocPermission}
                    onChange={(v) => setNewAssocPermission(v as 'viewer' | 'editor')}
                    className="grid-cols-2"
                    options={[
                      { value: 'editor', label: '可编辑' },
                      { value: 'viewer', label: '仅查看' }
                    ]}
                  />
                </div>
              )}
            </fieldset>
          )}
          <div className="mt-[var(--space-1)] grid grid-cols-2 gap-[var(--space-2)]">
            <Button type="button" size="md" onClick={createNew} fullWidth>
              创建
            </Button>
            <Button
              type="button"
              size="md"
              variant="default"
              onClick={() => setCreating(false)}
              fullWidth
            >
              取消
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          type="button"
          variant="secondary"
          leadingIcon={<PlusIcon />}
          onClick={() => setCreating(true)}
          fullWidth
        >
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
            { label: '重置密码', onSelect: () => setResetFor(activeMember) },
            {
              label: '移除成员',
              destructive: true,
              onSelect: () => setRemoveFor(activeMember)
            }
          ]}
        />
      )}

      {editingAssoc && (
        <ActionSheet
          open={Boolean(editingAssoc)}
          onOpenChange={(o) => {
            if (!o) setEditingAssoc(null);
          }}
          title={editingAssoc.perm.babyName}
          options={[
            editingAssoc.perm.permission === 'editor'
              ? {
                  label: '改为「仅查看」',
                  onSelect: () =>
                    changeAssoc(
                      editingAssoc.member.memberId,
                      editingAssoc.perm.babyId,
                      'viewer'
                    )
                }
              : {
                  label: '改为「可编辑」',
                  onSelect: () =>
                    changeAssoc(
                      editingAssoc.member.memberId,
                      editingAssoc.perm.babyId,
                      'editor'
                    )
                },
            {
              label: '解除关联',
              destructive: true,
              onSelect: () =>
                removeAssoc(editingAssoc.member.memberId, editingAssoc.perm.babyId)
            }
          ]}
        />
      )}

      {assocFor && (
        <BabyAssociationSheet
          open={Boolean(assocFor)}
          onOpenChange={(o) => {
            if (!o) setAssocFor(null);
          }}
          availableBabies={availableBabiesFor(assocFor)}
          onConfirm={({ babyIds, permission }) =>
            addAssocs(assocFor.memberId, babyIds, permission)
          }
        />
      )}

      <Modal
        open={Boolean(resetFor)}
        onOpenChange={(o) => {
          if (!o) {
            setResetFor(null);
            setResetPassword('');
          }
        }}
        title="重置密码"
        footer={
          <>
            <Button type="button" variant="default" onClick={() => setResetFor(null)}>
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
      </Modal>

      <Modal
        open={Boolean(removeFor)}
        onOpenChange={(o) => {
          if (!o) setRemoveFor(null);
        }}
        title="移除成员"
        footer={
          <>
            <Button type="button" variant="default" onClick={() => setRemoveFor(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="error"
              onClick={() => removeFor && remove(removeFor.userId)}
            >
              移除
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          确认移除 {removeFor?.nickname ?? '该成员'}? 该成员将无法登录,但他们已记录的内容会保留。
        </p>
      </Modal>
    </AppShell>
  );
}
