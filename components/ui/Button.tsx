import * as React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'error' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-accent)] text-[color:var(--color-on-solid)] hover:bg-[var(--color-accent-hover)]',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-fg)]',
  ghost: 'bg-transparent text-[var(--color-accent)] shadow-none hover:underline',
  error: 'bg-[var(--color-error)] text-[color:var(--color-on-solid)] shadow-[var(--shadow-press-error)]',
  success: 'bg-[var(--color-success)] text-[color:var(--color-on-solid)] shadow-[var(--shadow-press-success)]'
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-[var(--space-3)] text-[var(--text-sm)]',
  md: 'min-h-10 px-[var(--space-4)] text-[var(--text-base)]',
  lg: 'min-h-12 px-[var(--space-6)] text-[var(--text-lg)]'
};

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const solidVariant = variant === 'primary' || variant === 'error' || variant === 'success';

  return (
    <button
      className={cn(
        'bl-button inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-bold shadow-[var(--shadow-press)] transition-[box-shadow,transform,background-color] duration-[var(--duration-fast)] ease-[var(--ease-press)] hover:-translate-y-px hover:shadow-[var(--shadow-press-hover)] active:translate-y-1 active:shadow-[var(--shadow-press-active)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'bl-button--full w-full',
        loading && 'pointer-events-none',
        className
      )}
      data-size={size}
      data-variant={variant}
      style={{ ...(solidVariant ? { color: 'var(--color-on-solid)' } : {}), ...style }}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      {...rest}
    >
      {loading ? <Spinner className="text-current" /> : leadingIcon}
      <span className={cn(loading && 'opacity-60')}>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}
