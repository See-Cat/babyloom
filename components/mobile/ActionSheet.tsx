'use client';

import * as React from 'react';
import { cn } from '@/lib/shared/cn';
import { usePopupAnimation } from '@/lib/client/hooks/usePopupAnimation';

export interface ActionSheetOption {
  label: string;
  destructive?: boolean;
  emphasized?: boolean;
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
  const { mounted, visible } = usePopupAnimation(open, 300);

  if (!mounted) return null;

  return (
    <div
      className={cn('scrim', visible && 'show')}
      role="presentation"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className={cn('action', visible && 'show')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="group">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={option.disabled}
              data-destructive={option.destructive ? true : undefined}
              data-emphasized={option.emphasized ? true : undefined}
              className={cn(
                'item',
                option.destructive && 'destructive',
                option.emphasized && !option.destructive && 'emphasized'
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
        <button type="button" className="cancel" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
