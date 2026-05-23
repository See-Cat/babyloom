import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
}

export function Spinner({ className, label = '加载中', ...rest }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('bl-spinner inline-flex items-center', className)} {...rest}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 animate-spin text-[color:var(--color-accent)] motion-reduce:hidden"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeDasharray="42 18"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <span aria-hidden="true" className="hidden text-[color:var(--color-accent)] motion-reduce:inline">
        …
      </span>
    </span>
  );
}
