'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
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
  leadingAction?: ReactNode;
  trailingAction?: ReactNode;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissible = true,
  leadingAction,
  trailingAction
}: BottomSheetProps) {
  const titleId = React.useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const { panelRef, panelProps } = useDialog({ open, onOpenChange, titleId, descriptionId, dismissible });
  const { mounted, visible } = usePopupAnimation(open, 300);
  const handleRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ y: 0, time: 0, active: false });
  const [dragY, setDragY] = React.useState(0);

  // Attach touch listeners on the drag handle only, with passive:false so
  // preventDefault() actually works. Scoping to the handle means scrolling
  // inside the sheet content (e.g. a wheel picker) cannot accidentally
  // dismiss the sheet.
  React.useEffect(() => {
    if (!mounted || !dismissible) return;
    const node = handleRef.current;
    if (!node) return;

    function onTouchStart(event: TouchEvent) {
      dragRef.current = { y: event.touches[0].clientY, time: Date.now(), active: true };
    }
    function onTouchMove(event: TouchEvent) {
      if (!dragRef.current.active) return;
      const nextY = Math.max(0, event.touches[0].clientY - dragRef.current.y);
      if (nextY > 0) event.preventDefault();
      setDragY(nextY);
    }
    function onTouchEnd() {
      if (!dragRef.current.active) return;
      const elapsed = Math.max(1, Date.now() - dragRef.current.time);
      const velocity = dragY / elapsed;
      dragRef.current.active = false;
      if (dragY > 80 || velocity > 0.5) {
        onOpenChange(false);
      }
      setDragY(0);
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [mounted, dismissible, dragY, onOpenChange]);

  if (!mounted) return null;

  const sheetStyle: React.CSSProperties =
    dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {};

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
        {...panelProps}
      >
        <div
          ref={handleRef}
          className="-mx-5 -mt-[18px] px-5 pt-[18px] pb-2 cursor-grab touch-none select-none"
          aria-hidden="true"
        >
          <div className="handle" />
        </div>
        {leadingAction || trailingAction ? (
          <div className="mb-[14px] grid grid-cols-[1fr_auto_1fr] items-center gap-[var(--space-2)]">
            <div className="justify-self-start">{leadingAction}</div>
            <h3 id={titleId} className="!m-0 justify-self-center text-center">{title}</h3>
            <div className="justify-self-end">{trailingAction}</div>
          </div>
        ) : (
          <h3 id={titleId}>{title}</h3>
        )}
        {description && (
          <p id={descriptionId} className="text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">
            {description}
          </p>
        )}
        {children && <div>{children}</div>}
        {footer && <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-3)]">{footer}</div>}
      </div>
    </div>
  );
}
