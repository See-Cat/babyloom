import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/offline', revision: String(Date.now()) }]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./lib/server/db/migrations/**/*']
  },
  serverExternalPackages: [
    'better-sqlite3',
    'bindings',
    'ffmpeg-static',
    'ffprobe-static',
    'file-type',
    'fluent-ffmpeg',
    'formidable',
    'pino',
    'sharp'
  ],
  webpack: (config, { isServer, nextRuntime, webpack }) => {
    const isEdge = nextRuntime === 'edge';

    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
        '**/node_modules/**',
        '**/.next/**',
        '**/.playwright-mcp/**',
        '**/playwright-report/**',
        '**/test-results/**'
      ]
    };

    // Native/Node-only deps must never enter the client or edge bundle.
    if (!isServer || isEdge) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'better-sqlite3': false,
        'bindings': false,
        'ffmpeg-static': false,
        'ffprobe-static': false,
        'file-type': false,
        'fluent-ffmpeg': false,
        'formidable': false,
        'pino': false,
        'sharp': false
      };
    }

    if (isEdge) {
      // Rewrite `node:foo` URI imports to bare `foo` so the alias-to-false
      // below can stub them. Webpack's URI scheme handler rejects `node:`
      // before alias resolution unless we replace it first.
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );

      // The edge compilation of instrumentation.ts pulls in modules whose
      // dependencies (e.g. bindings → require('path')) cannot be resolved on
      // edge. Stub built-in node modules in the edge bundle; the real startup
      // code is gated by NEXT_RUNTIME==='nodejs'.
      const NODE_BUILTINS = [
        'fs', 'path', 'crypto', 'os', 'url', 'stream', 'util', 'buffer',
        'events', 'http', 'https', 'net', 'tls', 'zlib', 'assert',
        'child_process', 'worker_threads', 'module', 'perf_hooks',
        'querystring', 'process'
      ];
      for (const m of NODE_BUILTINS) {
        config.resolve.alias[m] = false;
      }
    }

    return config;
  }
};

export default withSerwist(nextConfig);
