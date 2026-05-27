'use client';

import { cn } from '@/lib/shared/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { CheckIcon } from '@/components/ui/icons';

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
  function handlePick(babyId: string) {
    onConfirm({ babyIds: [babyId], permission: defaultPermission });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="关联宝宝">
      <div className="flex flex-col gap-[var(--space-3)]">
        {availableBabies.length === 0 ? (
          <p className="text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">
            已关联全部宝宝
          </p>
        ) : (
          <div className="flex flex-col">
            {availableBabies.map((baby) => (
              <button
                type="button"
                key={baby.id}
                aria-label={baby.name}
                onClick={() => handlePick(baby.id)}
                className={cn(
                  'flex items-center gap-[var(--space-3)] rounded-[14px] px-[6px] py-[10px] text-left transition-colors active:bg-[var(--color-surface)]'
                )}
              >
                <Avatar
                  src={baby.avatarUrl ?? undefined}
                  name={baby.name}
                  colorKey={baby.id}
                  size="sm"
                />
                <span className="flex-1 truncate text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
                  {baby.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
