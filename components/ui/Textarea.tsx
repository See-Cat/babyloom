'use client';

import * as React from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/shared/cn';

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
    <label className="field" htmlFor={textareaId}>
      {label}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'textarea',
          error && 'error',
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
        <p id={errorId} aria-live="polite" className="input-error-msg">
          {error}
        </p>
      )}
    </label>
  );
}
