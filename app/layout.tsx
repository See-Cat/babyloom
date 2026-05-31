import './globals.css';
import { resolveTimezone } from '@/lib/server/config/resolve-timezone';
import { ClientErrorBoundary } from '@/components/system/ClientErrorBoundary';
import { TimezoneProvider } from '@/components/system/TimezoneProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata = {
  title: 'Babyloom',
  description: 'Family baby memories',
  icons: {
    icon: [
      { url: '/icons/icon-source.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/icons/icon-192.png'
  }
};

// This app renders per request: cookie auth + local SQLite + runtime config.yaml
// (absent at build time). Opt the whole tree out of static prerendering. The PWA
// offline fallback (/offline) is precached by the service worker at install, so
// it still works offline even though it is rendered dynamically.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const timeZone = resolveTimezone();
  const now = Date.now();
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <link rel="preload" as="font" type="font/woff2" crossOrigin="" href="/fonts/nunito-400.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="" href="/fonts/noto-sans-sc-400.woff2" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={`#${'19c8b9'}`} />
      </head>
      <body>
        <ClientErrorBoundary>
          <TimezoneProvider timeZone={timeZone} now={now}>
            <ToastProvider>{children}</ToastProvider>
          </TimezoneProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
