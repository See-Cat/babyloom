import * as React from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, label = '加载中', size = 'md', ...rest }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('spinner', `spinner-${size}`, className)} {...rest} />
  );
}
