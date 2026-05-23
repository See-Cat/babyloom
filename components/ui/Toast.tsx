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
  success: 'success',
  error: 'error'
};

export function Toast({ message, variant = 'neutral', action }: ToastProps) {
  return (
    <div
      role="status"
      data-variant={variant}
      className={cn(
        'toast',
        variantClass[variant],
        'pointer-events-auto w-full max-w-sm justify-between animate-[toast-in_var(--duration-slow)_var(--ease)_backwards]'
      )}
    >
      <span>{message}</span>
      {action}
    </div>
  );
}
