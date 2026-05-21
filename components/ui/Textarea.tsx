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
          'min-h-[100px] max-h-[calc(6*1.55em+32px)] resize-none rounded-[var(--radius-card)] border-2 border-[var(--color-border-light)] bg-[var(--color-surface-2)] px-[14px] py-[var(--space-3)] text-[var(--text-base)] font-normal leading-[var(--leading-base)] shadow-[var(--shadow-soft-sm)] outline-none placeholder:text-[var(--color-fg-soft)] focus:border-[var(--color-focus)] focus:shadow-[var(--shadow-focus)]',
          error && 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:shadow-[var(--shadow-focus-error)]',
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
