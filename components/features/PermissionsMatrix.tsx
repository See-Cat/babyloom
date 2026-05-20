'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resetMemberRow } from '@/app/profile/members/permissions/actions';
import { PermissionCell, type PermissionBits } from '@/components/features/PermissionCell';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/lib/hooks/useToast';

export interface PermissionsMatrixMember {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'editor' | 'viewer';
  effectiveAccess: string[];
}

export interface PermissionsMatrixBaby {
  id: string;
  name: string;
}

export interface PermissionsMatrixOverride {
  memberId: string;
  babyId: string;
  override: PermissionBits | null;
}

export interface PermissionsMatrixProps {
  members: PermissionsMatrixMember[];
  babies: PermissionsMatrixBaby[];
  overrides: PermissionsMatrixOverride[];
}

export function PermissionsMatrix({ babies, members, overrides }: PermissionsMatrixProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const byPair = new Map(overrides.map((row) => [`${row.memberId}:${row.babyId}`, row.override]));

  function reset(memberId: string) {
    startTransition(async () => {
      const result = await resetMemberRow(memberId);
      toast.show({
        message: result.ok ? '已重置为默认权限' : '重置失败',
        variant: result.ok ? 'neutral' : 'error'
      });
      if (result.ok) router.refresh();
    });
  }

  if (members.length === 0 || babies.length === 0) {
    return <p className="text-[var(--text-sm)] text-[var(--color-muted)]">暂无可配置成员或宝宝</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-[var(--text-sm)] text-[var(--color-muted)]">
            <th className="sticky left-0 z-10 bg-[var(--color-surface)] p-[var(--space-2)]">
              成员
            </th>
            {babies.map((baby) => (
              <th key={baby.id} className="p-[var(--space-2)] font-semibold">
                {baby.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="align-top">
              <th className="sticky left-0 z-10 w-52 bg-[var(--color-surface)] p-[var(--space-2)] text-left">
                <div className="flex flex-col gap-[var(--space-2)]">
                  <div>
                    <p className="font-bold text-[var(--color-fg-strong)]">{member.nickname}</p>
                    <p className="text-[var(--text-xs)] text-[var(--color-muted)]">
                      @{member.username}
                    </p>
                  </div>
                  <Tag variant={member.role === 'editor' ? 'accent' : 'neutral'}>{member.role}</Tag>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => reset(member.id)}
                  >
                    重置为默认
                  </Button>
                  <details className="text-[var(--text-xs)] text-[var(--color-muted)]">
                    <summary className="cursor-pointer font-semibold text-[var(--color-fg)]">
                      实际访问
                    </summary>
                    <ul className="mt-[var(--space-2)] flex flex-col gap-1">
                      {member.effectiveAccess.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              </th>
              {babies.map((baby) => (
                <td key={baby.id} className="p-[var(--space-2)]">
                  <PermissionCell
                    member={member}
                    baby={baby}
                    override={byPair.get(`${member.id}:${baby.id}`) ?? null}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
