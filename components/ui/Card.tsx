import * as React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardElement = 'div' | 'article' | 'section';
type CardVariant = 'default' | 'dashed' | 'tinted';
type CardTint = 'pink' | 'blue' | 'yellow' | 'mint' | 'peach' | 'teal' | 'purple' | 'green';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  interactive?: boolean;
  as?: CardElement;
  variant?: CardVariant;
  tint?: CardTint;
}

export function Card({
  as: Component = 'div',
  children,
  className,
  interactive = false,
  variant = 'default',
  tint = 'mint',
  style,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cn(
        'card',
        variant === 'dashed' && 'card-dashed',
        variant === 'tinted' && `card-tinted ${tint}`,
        className
      )}
      data-variant={variant}
      data-interactive={interactive || undefined}
      style={style}
      {...rest}
    >
      {children}
    </Component>
  );
}
