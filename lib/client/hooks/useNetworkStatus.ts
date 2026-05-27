'use client';

import * as React from 'react';

function getSnapshot() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

export function useNetworkStatus() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => true);
}
