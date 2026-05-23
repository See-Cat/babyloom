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

const tintToken: Record<CardTint, string> = {
  pink: 'var(--color-avatar-pink)',
  blue: 'var(--color-avatar-blue)',
  yellow: 'var(--color-avatar-yellow)',
  mint: 'var(--color-avatar-mint)',
  peach: 'var(--color-avatar-peach)',
  teal: 'var(--color-avatar-teal)',
  purple: 'var(--color-avatar-purple)',
  green: 'var(--color-avatar-green)'
};

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
        'bl-card rounded-[var(--radius-card)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-4)]',
        variant === 'dashed' && 'border-2 border-dashed border-[var(--color-border-light)] bg-[var(--color-surface-2)]',
        variant === 'tinted' && 'bg-[var(--card-bg)]',
        interactive && 'bl-card--interactive',
        className
      )}
      data-variant={variant}
      style={{
        ...(variant === 'tinted'
          ? {
              '--card-tint': tintToken[tint],
              '--card-bg': 'color-mix(in srgb, var(--card-tint) 18%, var(--color-surface))'
            }
          : {}),
        ...style
      } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Component>
  );
}
