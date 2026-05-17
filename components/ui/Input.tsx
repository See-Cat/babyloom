import * as React from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leadingSlot?: ReactNode;
  trailingSlot?: ReactNode;
}

export function Input({ className, error, id, label, leadingSlot, trailingSlot, ...rest }: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <label className="bl-input flex flex-col gap-1 text-[var(--text-sm)] font-semibold text-[var(--color-fg)]" htmlFor={inputId}>
      {label}
      <span
        className={cn(
          'flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-3)] py-[var(--space-2)] focus-within:border-[var(--color-accent)]',
          error && 'border-[var(--color-error)]'
        )}
      >
        {leadingSlot}
        <input
          id={inputId}
          className={cn('min-w-0 flex-1 bg-transparent text-[var(--text-base)] font-normal outline-none placeholder:text-[var(--color-muted)]', className)}
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {trailingSlot}
      </span>
      {error && (
        <p id={errorId} aria-live="polite" className="text-[var(--text-sm)] font-normal text-[var(--color-error)]">
          {error}
        </p>
      )}
    </label>
  );
}
