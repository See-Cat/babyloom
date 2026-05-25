import * as React from 'react';
import { cn } from '@/lib/cn';
import { CheckIcon, ErrorIcon, InfoIcon, WarningIcon } from './icons';

export type ToastVariant = 'neutral' | 'success' | 'error' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  action?: ToastAction;
  icon?: React.ReactNode;
}

const variantClass: Record<ToastVariant, string> = {
  neutral: '',
  success: 'success',
  error: 'error',
  warning: 'warning'
};

const defaultIcon: Record<ToastVariant, React.ReactNode> = {
  neutral: <InfoIcon />,
  success: <CheckIcon />,
  error: <ErrorIcon />,
  warning: <WarningIcon />
};

export function Toast({ message, variant = 'neutral', action, icon }: ToastProps) {
  return (
    <div
      role="status"
      data-variant={variant}
      className={cn(
        'toast',
        variantClass[variant],
        'pointer-events-auto animate-[toast-in_var(--duration-slow)_var(--ease)_backwards]'
      )}
    >
      <span className="icon" aria-hidden="true">
        {icon ?? defaultIcon[variant]}
      </span>
      <span>{message}</span>
      {action && (
        <button type="button" className="action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
