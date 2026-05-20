interface ClientErrorPayload {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}

let installed = false;
const lastSent = new Map<string, number>();

export function reportClientError(payload: ClientErrorPayload) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const now = Date.now();
  const key = payload.message;
  const previous = lastSent.get(key);
  if (previous && now - previous < 5000) return;
  lastSent.set(key, now);

  fetch('/api/log/client', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: payload.message.slice(0, 4000),
      stack: payload.stack?.slice(0, 8000),
      url: payload.url,
      userAgent: payload.userAgent
    }),
    keepalive: true
  }).catch(() => {});
}

export function installErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.onerror = (message, source, line, column, error) => {
    reportClientError({
      message: String(message),
      stack: error?.stack,
      url: typeof source === 'string' ? source : window.location.href,
      userAgent: navigator.userAgent
    });
    return false;
  };

  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    reportClientError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  };
}

export function resetErrorReporterForTesting() {
  installed = false;
  lastSent.clear();
}
