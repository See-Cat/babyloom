'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export interface BabyOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface BabyAssociationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBabies: BabyOption[];
  defaultPermission?: 'viewer' | 'editor';
  onConfirm: (result: { babyIds: string[]; permission: 'viewer' | 'editor' }) => void;
}

export function BabyAssociationSheet({
  open,
  onOpenChange,
  availableBabies,
  defaultPermission = 'editor',
  onConfirm
}: BabyAssociationSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<'viewer' | 'editor'>(defaultPermission);

  useEffect(() => {
    if (open) {
      setSelected(availableBabies.length === 1 ? new Set([availableBabies[0].id]) : new Set());
      setPermission(defaultPermission);
    }
  }, [open, availableBabies, defaultPermission]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleConfirm() {
    onConfirm({ babyIds: Array.from(selected), permission });
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="关联宝宝"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.size === 0}>
            确认
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--space-3)]">
        {availableBabies.length === 0 ? (
          <p className="text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">
            已关联全部宝宝
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {availableBabies.map((baby) => (
              <li key={baby.id}>
                <label className="flex items-center gap-[var(--space-2)]">
                  <input
                    type="checkbox"
                    aria-label={baby.name}
                    checked={selected.has(baby.id)}
                    onChange={() => toggle(baby.id)}
                  />
                  <Avatar
                    src={baby.avatarUrl ?? undefined}
                    name={baby.name}
                    colorKey={baby.id}
                    size="sm"
                  />
                  <span className="text-[length:var(--text-sm)] text-[color:var(--color-fg)]">
                    {baby.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {availableBabies.length > 0 && (
          <div>
            <p className="mb-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)]">
              权限
            </p>
            <SegmentedControl
              ariaLabel="权限"
              value={permission}
              onChange={(v) => setPermission(v as 'viewer' | 'editor')}
              className="grid-cols-2"
              options={[
                { value: 'editor', label: '可编辑' },
                { value: 'viewer', label: '仅查看' }
              ]}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
