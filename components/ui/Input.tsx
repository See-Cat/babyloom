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
  const inputClassName = cn('input', error && 'error', className);

  return (
    <label className="field" htmlFor={inputId}>
      {label}
      {hasSlots ? (
        <span className={cn('input-wrap', hasLeadingSlot && 'with-leading', hasTrailingSlot && 'with-trailing')}>
          {leadingSlot && (
            <span className="leading">
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
            <span className="trailing">
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
        <p id={errorId} aria-live="polite" className="input-error-msg">
          {error}
        </p>
      )}
    </label>
  );
}
