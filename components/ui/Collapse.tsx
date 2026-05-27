'use client';

import * as React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/shared/cn';

export interface CollapseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
}

export function Collapse({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  title,
  children,
  className,
  ...rest
}: CollapseProps) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;

  function toggle() {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  if (!title) {
    return (
      <div
        aria-hidden={!open}
        className={cn(
          'bl-collapse grid transition-[grid-template-rows] duration-[var(--duration-slow)] ease-[var(--ease)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          className
        )}
        data-state={open ? 'open' : 'closed'}
        {...rest}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('bl-collapse-card', className)} data-state={open ? 'open' : 'closed'} {...rest}>
      <button
        type="button"
        className="bl-collapse-card-summary"
        aria-expanded={open}
        onClick={toggle}
      >
        <span>{title}</span>
        <span className="bl-collapse-card-chevron" aria-hidden="true">▾</span>
      </button>
      <div
        aria-hidden={!open}
        className={cn(
          'bl-collapse grid transition-[grid-template-rows] duration-[var(--duration-slow)] ease-[var(--ease)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="bl-collapse-card-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
