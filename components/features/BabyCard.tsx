'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/shared/cn';

export interface BabyCardProps {
  baby: {
    id: string;
    name: string;
    birthday: string;
    gender: string;
    avatarUrl?: string | null;
  };
  editing?: boolean;
  editName?: string;
  onEditNameChange?: (value: string) => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSave?: () => void;
  onTrash?: () => void;
  active?: boolean;
  ageLabel?: string;
  onSelect?: () => void;
}

export function BabyCard({ baby, editing, editName, onCancelEdit, onEditNameChange, onSave, active = false, ageLabel, onSelect }: BabyCardProps) {
  return (
    <Card className={cn(active && 'border border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] bg-[var(--color-primary-bg)]')}>
      {editing ? (
        <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-end">
          <Input label="名字" value={editName} onChange={(event) => onEditNameChange?.(event.target.value)} />
          <div className="flex gap-[var(--space-2)]">
            <Button type="button" size="sm" onClick={onSave}>
              保存
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-[var(--space-3)] text-left"
          aria-current={active ? 'true' : undefined}
          onClick={onSelect}
          disabled={!onSelect}
        >
          <Avatar src={baby.avatarUrl ?? undefined} name={baby.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[var(--space-2)]">
              <p className="truncate text-[length:var(--text-lg)] font-bold text-[color:var(--color-fg-strong)]">{baby.name}</p>
              {active && (
                <span className="rounded-[var(--radius-pill)] bg-[var(--color-primary-bg)] px-[var(--space-2)] py-[2px] text-[10px] font-bold text-[color:var(--color-primary-active)]">
                  记录中
                </span>
              )}
            </div>
            <p className="mt-[2px] text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">
              {ageLabel ?? baby.birthday}
            </p>
          </div>
          {onSelect && <ChevronRightIcon className="h-4 w-4 text-[color:var(--color-fg-soft)]" />}
        </button>
      )}
    </Card>
  );
}
