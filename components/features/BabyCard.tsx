'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AvatarUploader } from './AvatarUploader';

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
}

export function BabyCard({ baby, editing, editName, onCancelEdit, onEdit, onEditNameChange, onSave, onTrash }: BabyCardProps) {
  return (
    <Card>
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
        <div className="flex items-center justify-between gap-[var(--space-3)]">
          <div className="min-w-0">
            <AvatarUploader
              currentUrl={baby.avatarUrl}
              fallbackName={baby.name}
              target={`baby:${baby.id}`}
            />
            <p className="font-bold text-[var(--color-fg-strong)]">{baby.name}</p>
            <p className="text-[var(--text-xs)] text-[var(--color-muted)]">
              {baby.birthday} · {baby.gender}
            </p>
          </div>
          <div className="flex gap-[var(--space-2)]">
            <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
              编辑
            </Button>
            <Button type="button" size="sm" variant="error" onClick={onTrash}>
              删除
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
