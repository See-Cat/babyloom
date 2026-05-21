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
  primary: 'bg-[var(--color-primary)] text-[color:var(--color-fg-inverse)]',
  secondary: 'bg-[var(--color-surface-2)] text-[var(--color-fg)]',
  ghost: 'bg-transparent text-[var(--color-primary-active)] shadow-none active:opacity-70',
  error: 'bg-[var(--color-error)] text-[color:var(--color-fg-inverse)]',
  success: 'bg-[var(--color-success)] text-[color:var(--color-fg-inverse)]'
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-[var(--space-5)] text-[var(--text-sm)] shadow-[var(--shadow-press-sm)] active:translate-y-[2px] active:shadow-[var(--shadow-press-sm-active)]',
  md: 'min-h-10 px-[var(--space-6)] text-[var(--text-base)] shadow-[var(--shadow-press-md)] active:translate-y-[3px] active:shadow-[var(--shadow-press-md-active)]',
  lg: 'min-h-12 px-[29px] text-[var(--text-lg)] shadow-[var(--shadow-press-lg)] active:translate-y-[4px] active:shadow-[var(--shadow-press-lg-active)]'
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
  const pressShadow =
    variant === 'primary'
      ? 'var(--color-press-shadow-primary)'
      : variant === 'error'
        ? 'var(--color-press-shadow-error)'
        : variant === 'success'
          ? 'var(--color-success-active)'
          : 'var(--color-press-shadow)';

  return (
    <button
      className={cn(
        'bl-button inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-bold transition-[box-shadow,transform,background-color,opacity] duration-[var(--duration-press)] ease-[var(--ease)] disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        variant === 'ghost' && 'shadow-none active:translate-y-0 active:shadow-none',
        fullWidth && 'bl-button--full w-full',
        loading && 'pointer-events-none shadow-none active:translate-y-0',
        className
      )}
      data-size={size}
      data-variant={variant}
      style={{ '--color-press-shadow': pressShadow, ...(solidVariant ? { color: 'var(--color-fg-inverse)' } : {}), ...style } as React.CSSProperties}
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
