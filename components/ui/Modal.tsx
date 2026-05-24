'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useDialog } from '@/lib/hooks/useDialog';
import { usePopupAnimation } from '@/lib/hooks/usePopupAnimation';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}

export function Modal({ open, onOpenChange, title, description, children, footer, dismissible = true }: ModalProps) {
  const titleId = React.useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const { panelRef, panelProps } = useDialog({ open, onOpenChange, titleId, descriptionId, dismissible });
  const { mounted, visible } = usePopupAnimation(open, 250);

  if (!mounted) return null;

  return (
    <div
      className={cn('scrim', visible && 'show')}
      onMouseDown={() => {
        if (dismissible) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        className={cn('modal', visible && 'show')}
        onMouseDown={(event) => event.stopPropagation()}
        {...panelProps}
      >
        <h3 id={titleId}>{title}</h3>
        {description && <p id={descriptionId}>{description}</p>}
        {children && <div>{children}</div>}
        {footer && <div className="row">{footer}</div>}
      </div>
    </div>
  );
}
