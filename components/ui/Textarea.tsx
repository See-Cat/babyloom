'use client';

import * as React from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ className, error, id, label, onInput, ...rest }: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const ref = React.useRef<HTMLTextAreaElement>(null);

  function resize() {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }

  React.useEffect(resize, []);

  return (
    <label className="bl-textarea flex flex-col gap-1 text-[var(--text-sm)] font-semibold text-[var(--color-fg)]" htmlFor={textareaId}>
      {label}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'min-h-28 resize-none rounded-[var(--radius-sm)] border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-base)] font-normal outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]',
          error && 'border-[var(--color-error)]',
          className
        )}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        onInput={(event) => {
          resize();
          onInput?.(event);
        }}
        {...rest}
      />
      {error && (
        <p id={errorId} aria-live="polite" className="text-[var(--text-sm)] font-normal text-[var(--color-error)]">
          {error}
        </p>
      )}
    </label>
  );
}
