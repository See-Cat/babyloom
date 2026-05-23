'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
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
      <div className="bl-action-sheet flex flex-col gap-[var(--space-2)] text-center">
        <div className="overflow-hidden rounded-[var(--radius-base)] bg-[var(--color-surface-2)] shadow-[var(--shadow-soft-lg)]">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={option.disabled}
              data-destructive={option.destructive ? true : undefined}
              className={cn(
                'block w-full border-b border-[var(--color-border-light)] px-[var(--space-5)] py-[var(--space-4)] text-center text-[length:var(--text-md)] font-semibold text-[color:var(--color-fg)] last:border-b-0 active:bg-[var(--color-press-tint)] disabled:cursor-not-allowed disabled:opacity-50',
                option.destructive && 'text-[color:var(--color-error)]'
              )}
              onClick={() => {
                option.onSelect();
                onOpenChange(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-[var(--radius-base)] bg-[var(--color-surface-2)] px-[var(--space-5)] py-[var(--space-4)] text-center text-[length:var(--text-md)] font-bold text-[color:var(--color-fg)] shadow-[var(--shadow-soft-lg)] active:bg-[var(--color-press-tint)]"
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
