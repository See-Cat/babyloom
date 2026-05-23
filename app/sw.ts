import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname === '/timeline' || url.pathname === '/gallery',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 5,
            maxAgeSeconds: 7 * 24 * 60 * 60
          })
        ]
      })
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/media/') && url.searchParams.get('size') === 'thumb',
      handler: new CacheFirst({
        cacheName: 'thumbs',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60
          })
        ]
      })
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly()
    }
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.mode === 'navigate';
        }
      }
    ]
  }
});

serwist.addEventListeners();
