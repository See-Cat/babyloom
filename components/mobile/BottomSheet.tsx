'use client';

import * as React from 'react';
import type { ReactNode, TouchEvent } from 'react';
import { useDialog } from '@/lib/hooks/useDialog';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}

export function BottomSheet({ open, onOpenChange, title, description, children, footer, dismissible = true }: BottomSheetProps) {
  const titleId = React.useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const { panelRef, panelProps } = useDialog({ open, onOpenChange, titleId, descriptionId, dismissible });
  const dragRef = React.useRef({ y: 0, time: 0 });
  const [dragY, setDragY] = React.useState(0);

  if (!open) return null;

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

  return (
    <div className="fixed inset-0 z-[var(--z-sheet)] flex items-end bg-[var(--color-scrim)]" onMouseDown={() => {
      if (dismissible) onOpenChange(false);
    }}>
      <div
        ref={panelRef}
        className="w-full max-h-[90vh] overflow-auto rounded-t-[var(--radius-lg)] bg-[var(--color-surface-2)] px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[18px] text-[color:var(--color-fg)] shadow-[var(--shadow-sheet)] transition-transform duration-[var(--duration-slow)] ease-[var(--ease)]"
        style={{ transform: `translateY(${dragY}px)`, touchAction: 'pan-y' }}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        {...panelProps}
      >
        <div className="bl-bottom-sheet__handle mx-auto mb-[14px] h-1 w-9 rounded-[var(--radius-pill)] bg-[var(--color-border-light)]" />
        <h2 id={titleId} className="text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
            {description}
          </p>
        )}
        <div className="mt-[var(--space-4)]">{children}</div>
        {footer && <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-2)]">{footer}</div>}
      </div>
    </div>
  );
}
