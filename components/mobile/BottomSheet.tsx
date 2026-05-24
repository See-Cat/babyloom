'use client';

import * as React from 'react';
import type { ReactNode, TouchEvent } from 'react';
import { cn } from '@/lib/cn';
import { useDialog } from '@/lib/hooks/useDialog';
import { usePopupAnimation } from '@/lib/hooks/usePopupAnimation';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}

export function BottomSheet({ open, onOpenChange, title, description, children, footer, dismissible = true }: BottomSheetProps) {
  const titleId = React.useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const { panelRef, panelProps } = useDialog({ open, onOpenChange, titleId, descriptionId, dismissible });
  const { mounted, visible } = usePopupAnimation(open, 300);
  const dragRef = React.useRef({ y: 0, time: 0 });
  const [dragY, setDragY] = React.useState(0);

  if (!mounted) return null;

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    dragRef.current = { y: event.touches[0].clientY, time: Date.now() };
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    const nextY = Math.max(0, event.touches[0].clientY - dragRef.current.y);
    if (nextY > 0) event.preventDefault();
    setDragY(nextY);
  }

  function onTouchEnd() {
    const elapsed = Math.max(1, Date.now() - dragRef.current.time);
    const velocity = dragY / elapsed;
    if (dismissible && (dragY > 80 || velocity > 0.5)) {
      onOpenChange(false);
    }
    setDragY(0);
  }

  const sheetStyle: React.CSSProperties = {
    touchAction: 'pan-y',
    ...(dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {})
  };

  return (
    <div
      className={cn('scrim', visible && 'show')}
      onMouseDown={() => {
        if (dismissible) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        className={cn('sheet', visible && 'show')}
        style={sheetStyle}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        {...panelProps}
      >
        <div className="handle" />
        <h3 id={titleId}>{title}</h3>
        {description && (
          <p id={descriptionId} className="text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">
            {description}
          </p>
        )}
        {children && <div>{children}</div>}
        {footer && <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-2)]">{footer}</div>}
      </div>
    </div>
  );
}
