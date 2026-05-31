import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/offline', revision: String(Date.now()) }]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
  // file-type stays external (bundling it pulls strtok3's `node:fs/promises`
  // into a webpack chunk that fails to resolve at runtime). But Next's tracer
  // (nft) resolves the `default` exports condition and misses the `node`-only
  // entry files (e.g. strtok3/lib/index.js → ERR_MODULE_NOT_FOUND in
  // standalone). Force-copy the whole file-type dependency closure so every
  // condition's files are present regardless of which one nft picked.
  outputFileTracingIncludes: {
    '/*': [
      './lib/server/db/migrations/**/*',
      './node_modules/.pnpm/file-type@*/node_modules/file-type/**/*',
      './node_modules/.pnpm/strtok3@*/node_modules/strtok3/**/*',
      './node_modules/.pnpm/token-types@*/node_modules/token-types/**/*',
      './node_modules/.pnpm/uint8array-extras@*/node_modules/uint8array-extras/**/*',
      './node_modules/.pnpm/@tokenizer+inflate@*/node_modules/@tokenizer/inflate/**/*',
      './node_modules/.pnpm/@tokenizer+token@*/node_modules/@tokenizer/token/**/*',
      './node_modules/.pnpm/token-types@*/node_modules/@borewit/text-codec/**/*',
      './node_modules/.pnpm/ieee754@*/node_modules/ieee754/**/*',
      './node_modules/.pnpm/fflate@*/node_modules/fflate/**/*'
    ]
  },
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
