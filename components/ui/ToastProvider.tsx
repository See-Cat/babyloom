'use client';

import * as React from 'react';
import { Toast, type ToastVariant } from './Toast';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  action?: ToastAction;
}

export interface ShowToastOptions {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
}

export interface ToastContextValue {
  show: (options: ShowToastOptions) => void;
  dismiss: () => void;
}

export const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const dismiss = React.useCallback(() => setToast(null), []);
  const show = React.useCallback((options: ShowToastOptions) => {
    setToast({
      id: Date.now(),
      message: options.message,
      variant: options.variant ?? 'neutral',
      durationMs: options.durationMs ?? 5000,
      action: options.action
    });
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-[calc(var(--space-4)+env(safe-area-inset-bottom))] left-[var(--space-4)] right-[var(--space-4)] z-[var(--z-toast)] flex justify-center">
        {toast && (
          <Toast
            message={toast.message}
            variant={toast.variant}
            action={
              toast.action && {
                label: toast.action.label,
                onClick: () => {
                  toast.action?.onClick();
                  dismiss();
                }
              }
            }
          />
        )}
      </div>
    </ToastContext.Provider>
  );
}
