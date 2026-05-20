'use client';

import { useState, useTransition } from 'react';
import { setPermissionCell } from '@/app/profile/members/permissions/actions';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/cn';

export interface PermissionBits {
  canRead: number;
  canWrite: number;
  canDelete: number;
}

export interface PermissionCellProps {
  member: {
    id: string;
    nickname: string;
    role: 'editor' | 'viewer';
  };
  baby: {
    id: string;
    name: string;
  };
  override: PermissionBits | null;
}

const fields = [
  { key: 'canRead', label: '看' },
  { key: 'canWrite', label: '写' },
  { key: 'canDelete', label: '删' }
] as const;

function defaultBits(role: 'editor' | 'viewer'): PermissionBits {
  return role === 'editor'
    ? { canRead: 1, canWrite: 1, canDelete: 1 }
    : { canRead: 1, canWrite: 0, canDelete: 0 };
}

export function PermissionCell({ baby, member, override }: PermissionCellProps) {
  const [bits, setBits] = useState<PermissionBits>(override ?? defaultBits(member.role));
  const [hasOverride, setHasOverride] = useState(Boolean(override));
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function update(field: keyof PermissionBits, checked: boolean) {
    const previousBits = bits;
    const previousHasOverride = hasOverride;
    const next = { ...bits, [field]: checked ? 1 : 0 };
    setBits(next);
    setHasOverride(true);

    const formData = new FormData();
    formData.set('memberId', member.id);
    formData.set('babyId', baby.id);
    formData.set('field', field);
    formData.set('value', checked ? 'true' : 'false');

    startTransition(async () => {
      const result = await setPermissionCell(formData);
      if (!result.ok) {
        setBits(previousBits);
        setHasOverride(previousHasOverride);
        toast.show({ message: '权限保存失败', variant: 'error' });
      }
    });
  }

  return (
    <div
      className={cn(
        'min-w-52 rounded-[var(--radius-card)] border p-[var(--space-3)]',
        hasOverride
          ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
          : 'border-dotted border-[var(--color-muted)] bg-[var(--color-surface)]'
      )}
    >
      <p className="mb-[var(--space-2)] text-[var(--text-xs)] font-semibold text-[var(--color-muted)]">
        {hasOverride ? '已覆盖' : '默认(按角色)'}
      </p>
      <div className="grid grid-cols-3 gap-[var(--space-2)]">
        {fields.map((field) => {
          const disabled = member.role === 'viewer' && field.key !== 'canRead';
          return (
            <label
              key={field.key}
              className="flex min-w-0 flex-col items-center gap-[var(--space-1)] text-[var(--text-xs)] text-[var(--color-muted)]"
              title={disabled ? 'viewer 角色无写/删权限,即使勾选也无效' : undefined}
            >
              <span>{field.label}</span>
              <Switch
                aria-label={`${member.nickname} ${baby.name} ${field.label}`}
                checked={bits[field.key] === 1}
                disabled={isPending || disabled}
                onCheckedChange={(checked) => update(field.key, checked)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
