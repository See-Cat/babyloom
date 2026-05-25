import * as React from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { XIcon } from './icons';

type TagVariant = 'neutral' | 'accent' | 'error';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: TagVariant;
  removable?: boolean;
  onRemove?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
}

const variantClass: Record<TagVariant, string> = {
  neutral: '',
  accent: 'accent',
  error: 'error'
};

export function Tag({ children, className, variant = 'neutral', removable = false, onRemove, style, ...rest }: TagProps) {
  return (
    <span
      className={cn(
        'tag',
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
          className="x"
          onClick={onRemove}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
