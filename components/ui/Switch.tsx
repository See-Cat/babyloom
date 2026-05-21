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
        'bl-switch relative inline-flex h-6 w-10 items-center rounded-[var(--radius-pill)] bg-[var(--color-border-light)] p-[3px] transition-colors duration-[var(--duration-base)]',
        checked && 'bg-[var(--color-primary)]',
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
          'h-[18px] w-[18px] rounded-full bg-[var(--color-fg-inverse)] shadow-[var(--shadow-press-sm)] transition-transform duration-[var(--duration-base)]',
          checked && 'translate-x-4'
        )}
      />
    </button>
  );
}
