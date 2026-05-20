// @vitest-environment jsdom

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useNetworkStatus } from './useNetworkStatus';

describe('useNetworkStatus', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('reflects online and offline browser events', () => {
    act(() => {
      root.render(React.createElement(Probe));
    });
    expect(container.textContent).toBe('online');

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(container.textContent).toBe('offline');

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(container.textContent).toBe('online');
  });

  function Probe() {
    return React.createElement('span', null, useNetworkStatus() ? 'online' : 'offline');
  }

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value
    });
  }
});
