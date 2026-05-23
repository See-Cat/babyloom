import './globals.css';
import { ClientErrorBoundary } from '@/components/system/ClientErrorBoundary';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata = {
  title: 'Babyloom',
  description: 'Family baby memories'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          <ToastProvider>{children}</ToastProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
