'use client';

import * as React from 'react';
import { msUntilNextZonedMidnight } from '@/lib/shared/format-time';

// The app formats all timestamps in a single configured timezone (config.app.timezone)
// so server-rendered HTML and client hydration produce identical strings regardless
// of the viewer's device timezone. This context carries that timezone to client
// components (timeline, entry detail, logs) that format time during render.
const TimezoneContext = React.createContext<string>('Asia/Shanghai');

// The "now" used for relative-time labels ("今天/昨天"). It starts as a server-stamped
// value so SSR and the first client render agree (no #418 hydration mismatch), then
// the provider advances it to a live clock after mount and refreshes it at the next
// configured-zone midnight and whenever the tab becomes visible again — so a
// long-lived PWA tab doesn't freeze yesterday's labels.
// 0 means "no provider" (e.g. isolated component tests); callers fall back to Date.now().
const RenderNowContext = React.createContext<number>(0);

export function TimezoneProvider({
  timeZone,
  now,
  children
}: {
  timeZone: string;
  now: number;
  children: React.ReactNode;
}) {
  const [clock, setClock] = React.useState(now);

  React.useEffect(() => {
    // After hydration the server snapshot can go live without risking a mismatch.
    setClock(Date.now());

    let timer: number;
    const scheduleMidnight = () => {
      timer = window.setTimeout(() => {
        setClock(Date.now());
        scheduleMidnight();
      }, msUntilNextZonedMidnight(Date.now(), timeZone));
    };
    scheduleMidnight();

    // A backgrounded tab's timers can be throttled; re-sync on refocus so a tab
    // left open overnight corrects as soon as the user returns.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setClock(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timeZone]);

  return (
    <TimezoneContext.Provider value={timeZone}>
      <RenderNowContext.Provider value={clock}>{children}</RenderNowContext.Provider>
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return React.useContext(TimezoneContext);
}

export function useRenderNow(): number {
  return React.useContext(RenderNowContext);
}
