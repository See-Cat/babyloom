import * as React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type ButtonVariant =
  | 'primary'
  | 'default'
  | 'secondary'
  | 'ghost-primary'
  | 'ghost'
  | 'text'
  | 'link'
  | 'danger'
  | 'error'
  | 'success';
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
  default: 'bg-[var(--color-surface-2)] text-[color:var(--color-fg)]',
  secondary: 'bg-[var(--color-surface-2)] text-[color:var(--color-fg)]',
  'ghost-primary': 'border-2 border-[var(--color-primary)] bg-transparent text-[color:var(--color-primary-active)] shadow-none active:opacity-70',
  ghost: 'border-2 border-[var(--color-primary)] bg-transparent text-[color:var(--color-primary-active)] shadow-none active:opacity-70',
  text: 'bg-transparent text-[color:var(--color-fg)] shadow-none active:opacity-70',
  link: 'bg-transparent text-[color:var(--color-primary-active)] underline underline-offset-4 shadow-none active:opacity-70',
  danger: 'bg-[var(--color-error)] text-[color:var(--color-fg-inverse)]',
  error: 'bg-[var(--color-error)] text-[color:var(--color-fg-inverse)]',
  success: 'bg-[var(--color-success)] text-[color:var(--color-fg-inverse)]'
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-[var(--space-5)] text-[length:var(--text-sm)] active:translate-y-[2px]',
  md: 'min-h-10 px-[var(--space-6)] text-[length:var(--text-base)] active:translate-y-[3px]',
  lg: 'min-h-12 px-[29px] text-[length:var(--text-lg)] active:translate-y-[4px]'
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
  const normalizedVariant =
    variant === 'secondary' ? 'default' : variant === 'ghost' ? 'ghost-primary' : variant === 'error' ? 'danger' : variant;
  const solidVariant = normalizedVariant === 'primary' || normalizedVariant === 'danger' || normalizedVariant === 'success';
  const hasPressShadow = !['ghost-primary', 'text', 'link'].includes(normalizedVariant) && !loading;
  const pressShadowColor =
    normalizedVariant === 'primary'
      ? 'var(--color-press-shadow-primary)'
      : normalizedVariant === 'danger'
        ? 'var(--color-press-shadow-error)'
        : normalizedVariant === 'success'
          ? 'var(--color-success-active)'
          : 'var(--color-press-shadow)';
  const pressShadowHeight = size === 'sm' ? '3px' : size === 'md' ? '4px' : '5px';

  return (
    <button
      className={cn(
        'bl-button inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-bold transition-[box-shadow,transform,background-color,opacity] duration-[var(--duration-press)] ease-[var(--ease)] disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        hasPressShadow && 'shadow-[var(--button-shadow)] active:shadow-[var(--button-shadow-active)]',
        !hasPressShadow && 'shadow-none active:translate-y-0 active:shadow-none',
        fullWidth && 'bl-button--full w-full',
        loading && 'bl-button--loading pointer-events-none shadow-none active:translate-y-0',
        className
      )}
      data-size={size}
      data-variant={normalizedVariant}
      data-press-shadow={hasPressShadow}
      style={{
        '--button-shadow': `0 ${pressShadowHeight} 0 0 ${pressShadowColor}`,
        '--button-shadow-active': `0 1px 0 0 ${pressShadowColor}`,
        ...(solidVariant ? { color: 'var(--color-fg-inverse)' } : {}),
        ...style
      } as React.CSSProperties}
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
