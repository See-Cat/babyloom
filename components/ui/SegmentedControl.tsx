'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl({ ariaLabel, className, onChange, options, value }: SegmentedControlProps) {
  return (
    <div className={cn('grid rounded-[var(--radius-sm)] bg-[var(--color-bg-disabled)] p-[var(--space-1)]', className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-soft)]',
            value === option.value && 'bg-[var(--color-surface-2)] text-[color:var(--color-primary-active)]'
          )}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
