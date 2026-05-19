'use client';

import * as React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, className, disabled, onCheckedChange, onClick, onKeyDown, ...rest }: SwitchProps) {
  function toggle() {
    if (!disabled) onCheckedChange(!checked);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        'bl-switch relative inline-flex h-8 w-14 items-center rounded-[var(--radius-pill)] border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-1 transition-colors duration-[var(--duration-normal)] motion-reduce:transition-none',
        checked && 'border-[var(--color-accent)] bg-[var(--color-accent)]',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-5 w-5 rounded-full bg-[var(--color-bg)] shadow-[var(--shadow-press-active)] transition-transform duration-[var(--duration-normal)] motion-reduce:transition-none',
          checked && 'translate-x-6'
        )}
      />
    </button>
  );
}
