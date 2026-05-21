import * as React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CollapseProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  children: ReactNode;
}

export function Collapse({ open, children, className, ...rest }: CollapseProps) {
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
