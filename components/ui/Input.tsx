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
  const hasLeadingSlot = Boolean(leadingSlot);
  const hasTrailingSlot = Boolean(trailingSlot);
  const hasSlots = hasLeadingSlot || hasTrailingSlot;
  const inputClassName = cn(
    'block h-10 w-full rounded-[var(--radius-sm)] border-2 border-[var(--color-border-light)] bg-[var(--color-surface-2)] px-[14px] text-[length:var(--text-base)] font-normal text-[color:var(--color-fg)] shadow-[var(--shadow-soft-sm)] outline-none transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease)] placeholder:text-[color:var(--color-fg-disabled)] focus:border-[var(--color-focus)] focus:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[var(--color-bg-disabled)] disabled:opacity-50',
    hasLeadingSlot && 'pl-9',
    hasTrailingSlot && 'pr-9',
    error && 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:shadow-[var(--shadow-focus-error)]',
    className
  );

  return (
    <label className="bl-input flex flex-col gap-[6px] text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[color:var(--color-fg-soft)]" htmlFor={inputId}>
      {label}
      {hasSlots ? (
        <span className="relative block">
          {leadingSlot && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[length:var(--text-base)] text-[color:var(--color-fg-soft)]">
              {leadingSlot}
            </span>
          )}
          <input
            id={inputId}
            className={inputClassName}
            aria-describedby={errorId}
            aria-invalid={error ? true : undefined}
            {...rest}
          />
          {trailingSlot && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[length:var(--text-base)] text-[color:var(--color-fg-soft)]">
              {trailingSlot}
            </span>
          )}
        </span>
      ) : (
        <input
          id={inputId}
          className={inputClassName}
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
      )}
      {error && (
        <p id={errorId} aria-live="polite" className="text-[length:var(--text-sm)] font-normal text-[color:var(--color-error)]">
          {error}
        </p>
      )}
    </label>
  );
}
