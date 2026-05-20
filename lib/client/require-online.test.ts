import { describe, expect, it, vi } from 'vitest';
import { requireOnline } from './require-online';

describe('requireOnline', () => {
  it('returns true when navigator is unavailable', () => {
    expect(requireOnline({ show: vi.fn() })).toBe(true);
  });

  it('returns false and shows a toast while offline', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false }
    });
    const toast = { show: vi.fn() };

    expect(requireOnline(toast)).toBe(false);
    expect(toast.show).toHaveBeenCalledWith({
      message: '当前离线,无法保存。请检查网络后重试。',
      variant: 'error'
    });
  });
});
