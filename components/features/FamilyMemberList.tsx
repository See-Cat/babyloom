'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export interface FamilyMemberListItem {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface FamilyMemberListProps {
  members: FamilyMemberListItem[];
  onRoleChange?: (userId: string, role: 'editor' | 'viewer') => void;
  onResetPassword?: (userId: string) => void;
  onRemove?: (userId: string) => void;
  resetSlot?: (member: FamilyMemberListItem) => React.ReactNode;
}

export function FamilyMemberList({ members, onRemove, onResetPassword, onRoleChange, resetSlot }: FamilyMemberListProps) {
  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {members.map((member) => (
        <li key={member.memberId}>
          <Card>
            <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-[var(--color-fg-strong)]">{member.nickname}</p>
                <p className="text-[var(--text-xs)] text-[var(--color-muted)]">
                  @{member.username} · {member.role}
                </p>
              </div>
              {member.role !== 'owner' && (
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  <SegmentedControl
                    ariaLabel={`${member.nickname} 的角色`}
                    value={member.role}
                    onChange={(value) => onRoleChange?.(member.userId, value as 'editor' | 'viewer')}
                    className="grid-cols-2"
                    options={[
                      { value: 'editor', label: 'editor' },
                      { value: 'viewer', label: 'viewer' }
                    ]}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={() => onResetPassword?.(member.userId)}>
                    改密码
                  </Button>
                  <Button type="button" size="sm" variant="error" onClick={() => onRemove?.(member.userId)}>
                    移除
                  </Button>
                </div>
              )}
            </div>
            {resetSlot?.(member)}
          </Card>
        </li>
      ))}
    </ul>
  );
}
