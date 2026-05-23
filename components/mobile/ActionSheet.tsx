'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

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
  if (!open) return null;

  return (
    <div className="scrim" role="presentation" onMouseDown={() => onOpenChange(false)}>
      <div className="action show" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="group">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={option.disabled}
              data-destructive={option.destructive ? true : undefined}
              className={cn(
                'item',
                option.destructive && 'destructive'
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
          className="cancel"
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
