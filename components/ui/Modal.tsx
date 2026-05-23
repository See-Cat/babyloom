'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { useDialog } from '@/lib/hooks/useDialog';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}

export function Modal({ open, onOpenChange, title, description, children, footer, dismissible = true }: ModalProps) {
  const titleId = React.useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const { panelRef, panelProps } = useDialog({ open, onOpenChange, titleId, descriptionId, dismissible });

  if (!open) return null;

  return (
    <div className="scrim" onMouseDown={() => {
      if (dismissible) onOpenChange(false);
    }}>
      <div
        ref={panelRef}
        className="modal show"
        onMouseDown={(event) => event.stopPropagation()}
        {...panelProps}
      >
        <h3 id={titleId}>
          {title}
        </h3>
        {description && (
          <p id={descriptionId}>
            {description}
          </p>
        )}
        <div>{children}</div>
        {footer && <div className="row">{footer}</div>}
      </div>
    </div>
  );
}
