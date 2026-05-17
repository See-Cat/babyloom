'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from './BottomSheet';

export interface ActionSheetOption {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
}

export function ActionSheet({ open, onOpenChange, title, options, cancelLabel = '取消' }: ActionSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col gap-[var(--space-2)]">
        {options.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant={option.destructive ? 'error' : 'secondary'}
            disabled={option.disabled}
            data-destructive={option.destructive ? true : undefined}
            onClick={() => {
              option.onSelect();
              onOpenChange(false);
            }}
            fullWidth
          >
            {option.label}
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} fullWidth>
          {cancelLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
