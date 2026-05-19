import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('base', false, 'active', null, undefined, 'wide')).toBe('base active wide');
  });

  it('returns an empty string for empty or all-falsy input', () => {
    expect(cn()).toBe('');
    expect(cn(false, null, undefined)).toBe('');
  });
});
