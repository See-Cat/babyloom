import * as React from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TagVariant = 'neutral' | 'accent' | 'error';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: TagVariant;
  removable?: boolean;
  onRemove?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
}

const variantClass: Record<TagVariant, string> = {
  neutral: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]',
  accent: 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[color:var(--color-on-solid)]',
  error: 'border-[var(--color-error)] bg-[var(--color-error)] text-[color:var(--color-on-solid)]'
};

export function Tag({ children, className, variant = 'neutral', removable = false, onRemove, style, ...rest }: TagProps) {
  const solidVariant = variant === 'accent' || variant === 'error';

  return (
    <span
      className={cn(
        'bl-tag inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-[var(--space-3)] py-[var(--space-1)] text-[var(--text-sm)] font-semibold',
        variantClass[variant],
        className
      )}
      data-variant={variant}
      style={{ ...(solidVariant ? { color: 'var(--color-on-solid)' } : {}), ...style }}
      {...rest}
    >
      {children}
      {removable && (
        <button
          type="button"
          aria-label="移除"
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-pill)] text-current"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}
