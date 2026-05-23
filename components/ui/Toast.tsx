import * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ToastVariant = 'neutral' | 'success' | 'error';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  action?: ReactNode;
}

const variantClass: Record<ToastVariant, string> = {
  neutral: '',
  success: '',
  error: ''
};

export function Toast({ message, variant = 'neutral', action }: ToastProps) {
  return (
    <div
      role="status"
      data-variant={variant}
      className={cn(
        'bl-toast pointer-events-auto flex w-full max-w-sm items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-pill)] bg-[var(--color-fg)] px-[18px] py-[10px] text-[length:var(--text-sm)] text-[color:var(--color-fg-inverse)] shadow-[var(--shadow-soft-md)]',
        'animate-[toast-in_var(--duration-slow)_var(--ease)_backwards]',
        variantClass[variant]
      )}
    >
      <span>{message}</span>
      {action}
    </div>
  );
}
