'use client';

import * as React from 'react';
import { Tag } from '@/components/ui/Tag';
import { BottomSheet } from '@/components/mobile/BottomSheet';

export interface MilestonePickerItem {
  id: string;
  name: string;
  icon: string;
}

export interface MilestonePickerProps {
  milestones: MilestonePickerItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  visibleCount?: number;
}

export function MilestonePicker({ milestones, onToggle, selectedIds, visibleCount = 4 }: MilestonePickerProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  if (milestones.length === 0) return null;

  const inlineSet = new Set<string>();
  const inline: MilestonePickerItem[] = [];
  for (const m of milestones) {
    if (inline.length >= visibleCount) break;
    inline.push(m);
    inlineSet.add(m.id);
  }
  for (const m of milestones) {
    if (inlineSet.has(m.id)) continue;
    if (selectedIds.has(m.id)) {
      inline.push(m);
      inlineSet.add(m.id);
    }
  }
  const hasMore = milestones.length > inline.length;

  return (
    <div>
      <p className="mb-[var(--space-2)] px-[var(--space-1)] text-[length:var(--text-xs)] font-bold uppercase tracking-[0.5px] text-[color:var(--color-fg-soft)]">
        里程碑(可多选)
      </p>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {inline.map((m) => {
          const selected = selectedIds.has(m.id);
          return (
            <button key={m.id} type="button" aria-pressed={selected} onClick={() => onToggle(m.id)}>
              <Tag variant={selected ? 'accent' : 'neutral'}>{m.name}</Tag>
            </button>
          );
        })}
        {hasMore && (
          <button type="button" onClick={() => setMoreOpen(true)} aria-label="更多里程碑">
            <Tag variant="neutral">+ 更多</Tag>
          </button>
        )}
      </div>

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title={`选择里程碑${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}>
        <div className="-mx-[var(--space-2)] mt-[var(--space-2)] max-h-[60vh] overflow-y-auto px-[var(--space-2)]">
          <div className="flex flex-wrap gap-[var(--space-2)] pb-[var(--space-2)]">
            {milestones.map((m) => {
              const selected = selectedIds.has(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={selected} onClick={() => onToggle(m.id)}>
                  <Tag variant={selected ? 'accent' : 'neutral'}>{m.name}</Tag>
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
