'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useDialog } from '@/lib/hooks/useDialog';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
  const titleId = React.useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const { panelRef, panelProps } = useDialog({ open, onOpenChange, titleId, descriptionId });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--color-scrim)] p-[var(--space-4)]" onMouseDown={() => onOpenChange(false)}>
      <div
        ref={panelRef}
        className={cn(
          'relative w-full max-w-[min(calc(100vw-32px),480px)] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] px-[var(--space-6)] py-[22px] text-[var(--color-fg)] shadow-[var(--shadow-soft-lg)]',
          'animate-[dialog-in_var(--duration-base)_var(--ease)_backwards]'
        )}
        onMouseDown={(event) => event.stopPropagation()}
        {...panelProps}
      >
        <h2 id={titleId} className="text-[var(--text-xl)] font-bold text-[var(--color-fg-strong)]">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-muted)]">
            {description}
          </p>
        )}
        <div className="mt-[var(--space-4)]">{children}</div>
        {footer && <div className="mt-[var(--space-6)] flex justify-end gap-[var(--space-2)]">{footer}</div>}
      </div>
    </div>
  );
}
