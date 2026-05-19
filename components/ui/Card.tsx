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
        'bl-card rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-card)]',
        interactive &&
          'bl-card--interactive transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-press)] hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] motion-reduce:transform-none motion-reduce:transition-none',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
