'use client';

import * as React from 'react';

export interface UsePopupAnimationResult {
  mounted: boolean;
  visible: boolean;
}

/**
 * Keeps a popup mounted across enter/exit transitions so CSS animations
 * actually fire. `mounted` controls DOM presence; `visible` toggles the
 * `.show` class after a paint so the browser sees a state change.
 */
export function usePopupAnimation(open: boolean, exitDurationMs = 300): UsePopupAnimationResult {
  const [mounted, setMounted] = React.useState(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const handle = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(handle);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), exitDurationMs);
    return () => window.clearTimeout(timer);
  }, [open, exitDurationMs]);

  return { mounted, visible };
}
