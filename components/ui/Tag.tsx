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
  neutral: 'bg-[var(--color-bg-disabled)] text-[var(--color-fg-soft)]',
  accent: 'bg-[var(--color-primary-bg)] text-[var(--color-primary-active)]',
  error: 'bg-[var(--color-error-bg)] text-[var(--color-error-active)]'
};

export function Tag({ children, className, variant = 'neutral', removable = false, onRemove, style, ...rest }: TagProps) {
  return (
    <span
      className={cn(
        'bl-tag inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-[10px] py-[var(--space-1)] text-[var(--text-sm)] font-semibold',
        variantClass[variant],
        className
      )}
      data-variant={variant}
      style={style}
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
