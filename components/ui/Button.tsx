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
  primary: 'btn-primary',
  default: 'btn-default',
  secondary: 'btn-default',
  'ghost-primary': 'btn-ghost',
  ghost: 'btn-ghost',
  text: 'btn-text',
  link: 'btn-link',
  danger: 'btn-danger',
  error: 'btn-danger',
  success: 'btn-success'
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg'
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

  return (
    <button
      className={cn(
        'btn',
        sizeClass[size],
        variantClass[variant],
        fullWidth && 'w-full',
        loading && 'btn-loading',
        className
      )}
      data-size={size}
      data-variant={normalizedVariant}
      style={style}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      {...rest}
    >
      {loading ? <Spinner className="text-current" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}
