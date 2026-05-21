import * as React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardElement = 'div' | 'article' | 'section';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  interactive?: boolean;
  as?: CardElement;
}

export function Card({ as: Component = 'div', children, className, interactive = false, ...rest }: CardProps) {
  return (
    <Component
      className={cn(
        'bl-card rounded-[var(--radius-card)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-4)]',
        interactive && 'bl-card--interactive',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
