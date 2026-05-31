'use client';

import * as React from 'react';

// The app formats all timestamps in a single configured timezone (config.app.timezone)
// so server-rendered HTML and client hydration produce identical strings regardless
// of the viewer's device timezone. This context carries that timezone to client
// components (timeline, entry detail, logs) that format time during render.
const TimezoneContext = React.createContext<string>('Asia/Shanghai');

export function TimezoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <TimezoneContext.Provider value={timeZone}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): string {
  return React.useContext(TimezoneContext);
}
