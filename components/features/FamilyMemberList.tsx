'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

export interface FamilyMemberListItem {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface FamilyMemberListProps {
  members: FamilyMemberListItem[];
  onSelect?: (member: FamilyMemberListItem) => void;
  resetSlot?: (member: FamilyMemberListItem) => ReactNode;
}

export function FamilyMemberList({ members, onSelect, resetSlot }: FamilyMemberListProps) {
  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {members.map((member) => (
        <li key={member.memberId}>
          <Card className={cn(member.role === 'owner' && 'border border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] bg-[var(--color-primary-bg)]')}>
            <button
              type="button"
              className="flex w-full items-center gap-[var(--space-3)] text-left"
              disabled={member.role === 'owner'}
              onClick={() => onSelect?.(member)}
            >
              <Avatar name={member.nickname} size="lg" className={avatarClass(member.role)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[var(--space-2)]">
                  <p className="truncate font-bold text-[var(--color-fg-strong)]">{member.nickname}</p>
                  <span className={cn('rounded-[var(--radius-pill)] px-[var(--space-2)] py-[2px] text-[10px] font-bold', roleBadgeClass(member.role))}>
                    {roleLabel(member.role)}
                  </span>
                </div>
                <p className="truncate text-[var(--text-xs)] text-[var(--color-muted)]">
                  @{member.username} · {member.role === 'owner' ? '你自己' : '家庭成员'}
                </p>
              </div>
              {member.role !== 'owner' && (
                <span aria-hidden="true" className="text-[var(--color-fg-soft)]">›</span>
              )}
            </button>
            {resetSlot?.(member)}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function roleLabel(role: FamilyMemberListItem['role']) {
  if (role === 'owner') return '主理人';
  if (role === 'editor') return '编辑成员';
  return '仅查看';
}

function roleBadgeClass(role: FamilyMemberListItem['role']) {
  if (role === 'owner') return 'bg-[var(--color-primary-bg)] text-[var(--color-primary-active)]';
  if (role === 'editor') return 'bg-[var(--color-surface-2)] text-[var(--color-fg-strong)]';
  return 'bg-[var(--color-bg-disabled)] text-[var(--color-fg-soft)]';
}

function avatarClass(role: FamilyMemberListItem['role']) {
  if (role === 'owner') return 'bg-[var(--color-avatar-peach)]';
  if (role === 'editor') return 'bg-[var(--color-avatar-blue)]';
  return 'bg-[var(--color-avatar-purple)]';
}
