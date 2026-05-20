import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('installErrorReporter', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { href: 'http://localhost/timeline' }
      }
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        onLine: true,
        userAgent: 'vitest'
      }
    });
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it('dedupes identical error reports within five seconds', async () => {
    const { installErrorReporter } = await import('@/lib/client/error-reporter');

    installErrorReporter();
    window.onerror?.('same failure', 'app.js', 1, 1, new Error('same failure'));
    window.onerror?.('same failure', 'app.js', 1, 1, new Error('same failure'));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5001);
    window.onerror?.('same failure', 'app.js', 1, 1, new Error('same failure'));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
