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
  neutral: 'border-[var(--color-border)]',
  success: 'border-[var(--color-success)]',
  error: 'border-[var(--color-error)]'
};

export function Toast({ message, variant = 'neutral', action }: ToastProps) {
  return (
    <div
      role="status"
      data-variant={variant}
      className={cn(
        'bl-toast pointer-events-auto flex w-full max-w-sm items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-sm)] border-2 bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--text-sm)] text-[var(--color-fg)] shadow-[var(--shadow-card)]',
        'animate-[toast-in_var(--duration-normal)_var(--ease-out-expo)] motion-reduce:animate-none',
        variantClass[variant]
      )}
    >
      <span>{message}</span>
      {action}
    </div>
  );
}
