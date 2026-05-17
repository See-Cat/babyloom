'use client';

import { Tag } from '@/components/ui/Tag';

export interface MilestonePickerItem {
  id: string;
  name: string;
  icon: string;
}

export interface MilestonePickerProps {
  milestones: MilestonePickerItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function MilestonePicker({ milestones, onToggle, selectedIds }: MilestonePickerProps) {
  if (milestones.length === 0) return null;

  return (
    <div>
      <p className="mb-[var(--space-2)] text-[var(--text-sm)] font-bold text-[var(--color-fg-strong)]">里程碑</p>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {milestones.map((milestone) => {
          const selected = selectedIds.has(milestone.id);
          return (
            <button key={milestone.id} type="button" onClick={() => onToggle(milestone.id)}>
              <Tag variant={selected ? 'accent' : 'neutral'}>
                {milestone.icon} {milestone.name}
              </Tag>
            </button>
          );
        })}
      </div>
    </div>
  );
}
