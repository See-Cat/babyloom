import './globals.css';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata = {
  title: 'Babyloom',
  description: 'Family baby memories'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="preload" as="font" type="font/woff2" crossOrigin="" href="/fonts/nunito-400.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="" href="/fonts/noto-sans-sc-400.woff2" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
