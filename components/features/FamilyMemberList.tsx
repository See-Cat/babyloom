'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

export interface FamilyMemberBabyPermission {
  babyId: string;
  babyName: string;
  babyAvatarUrl: string | null;
  permission: 'viewer' | 'editor';
}

export interface FamilyMemberListItem {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'member';
  babyPermissions: FamilyMemberBabyPermission[];
}

export interface FamilyMemberListProps {
  members: FamilyMemberListItem[];
  onMemberAction: (member: FamilyMemberListItem) => void;
  onAssociationClick: (member: FamilyMemberListItem, perm: FamilyMemberBabyPermission) => void;
  onAddAssociation: (member: FamilyMemberListItem) => void;
  canAddDisabledReason?: (member: FamilyMemberListItem) => string | null;
}

export function FamilyMemberList({
  members,
  onMemberAction,
  onAssociationClick,
  onAddAssociation,
  canAddDisabledReason
}: FamilyMemberListProps) {
  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {members.map((member) => {
        const disabledReason = canAddDisabledReason?.(member) ?? null;
        return (
          <li key={member.memberId}>
            <Card>
              <div className="flex items-start gap-[var(--space-3)]">
                <Avatar name={member.nickname} size="lg" className="bg-[var(--color-avatar-blue)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[color:var(--color-fg-strong)]">{member.nickname}</p>
                  <p className="truncate text-[length:var(--text-xs)] text-[color:var(--color-muted)]">
                    @{member.username}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="更多操作"
                  className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-fg-soft)] active:bg-black/5"
                  onClick={() => onMemberAction(member)}
                >
                  ⋯
                </button>
              </div>

              {member.babyPermissions.length > 0 && (
                <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)] border-t border-[var(--color-border-light)] pt-[var(--space-3)]">
                  {member.babyPermissions.map((perm) => (
                    <li key={perm.babyId}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] py-[var(--space-1)] text-left active:bg-[var(--color-press-tint)]"
                        onClick={() => onAssociationClick(member, perm)}
                      >
                        <Avatar
                          src={perm.babyAvatarUrl ?? undefined}
                          name={perm.babyName}
                          colorKey={perm.babyId}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] text-[color:var(--color-fg)]">
                          {perm.babyName}
                        </span>
                        <span
                          className={cn(
                            'rounded-[var(--radius-pill)] px-[var(--space-2)] py-[2px] text-[10px] font-bold',
                            perm.permission === 'editor'
                              ? 'bg-[var(--color-surface-2)] text-[color:var(--color-fg-strong)]'
                              : 'bg-[var(--color-bg-disabled)] text-[color:var(--color-fg-soft)]'
                          )}
                        >
                          {perm.permission === 'editor' ? '可编辑' : '仅查看'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                disabled={Boolean(disabledReason)}
                onClick={() => onAddAssociation(member)}
                className={cn(
                  'mt-[var(--space-3)] w-full rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-[var(--space-2)] text-[length:var(--text-sm)] font-semibold',
                  disabledReason
                    ? 'cursor-not-allowed text-[color:var(--color-fg-soft)]'
                    : 'text-[color:var(--color-primary-active)] active:bg-[var(--color-press-tint)]'
                )}
              >
                + 关联宝宝
              </button>
              {disabledReason && (
                <p className="mt-[var(--space-1)] text-center text-[length:var(--text-xs)] text-[color:var(--color-fg-soft)]">
                  {disabledReason}
                </p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
