'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';

export interface MilestoneRowProps {
  milestone: {
    id: string;
    name: string;
    icon: string;
    isSystem?: boolean;
  };
  editing?: boolean;
  editDraft?: { name: string; icon: string };
  onEditDraftChange?: (draft: { name: string; icon: string }) => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSave?: () => void;
  onRemove?: () => void;
}

export function MilestoneRow({ milestone, editing, editDraft, onCancelEdit, onEdit, onEditDraftChange, onRemove, onSave }: MilestoneRowProps) {
  return (
    <Card>
      {editing ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <Input label="图标" value={editDraft?.icon ?? ''} maxLength={10} onChange={(event) => onEditDraftChange?.({ name: editDraft?.name ?? '', icon: event.target.value })} />
          <Input label="名称" value={editDraft?.name ?? ''} onChange={(event) => onEditDraftChange?.({ name: event.target.value, icon: editDraft?.icon ?? '' })} />
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
          <Tag variant={milestone.isSystem ? 'neutral' : 'accent'}>
            {milestone.icon} {milestone.name}
          </Tag>
          {!milestone.isSystem && (
            <div className="flex gap-[var(--space-2)]">
              <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
                编辑
              </Button>
              <Button type="button" size="sm" variant="error" onClick={onRemove}>
                删除
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
