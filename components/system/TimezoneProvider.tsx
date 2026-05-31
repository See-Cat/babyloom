'use client';

import * as React from 'react';

// The app formats all timestamps in a single configured timezone (config.app.timezone)
// so server-rendered HTML and client hydration produce identical strings regardless
// of the viewer's device timezone. This context carries that timezone to client
// components (timeline, entry detail, logs) that format time during render.
const TimezoneContext = React.createContext<string>('Asia/Shanghai');

// A server-stamped "now" (per request). Relative-time labels ("今天/昨天") use this
// instead of client Date.now() so SSR and hydration agree on the day boundary —
// otherwise a render straddling midnight re-triggers the #418 hydration mismatch.
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
  return (
    <TimezoneContext.Provider value={timeZone}>
      <RenderNowContext.Provider value={now}>{children}</RenderNowContext.Provider>
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return React.useContext(TimezoneContext);
}

export function useRenderNow(): number {
  return React.useContext(RenderNowContext);
}
