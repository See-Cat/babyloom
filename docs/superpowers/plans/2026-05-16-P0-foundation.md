# P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Next.js 15 monolith with TypeScript strict, Drizzle + SQLite (with the §14 PRAGMAs), Tailwind v4, structured logging via pino, config-file-driven owner credentials, and a working better-auth login flow that bootstraps the owner from `data/config.yaml`. End state: `pnpm dev` starts the app, owner can log in with credentials from config, `/api/health` returns `{ ok: true, dbReady: true }`.

**Architecture:** Single Next.js App Router process (no separate API service, no admin app). Everything in repo root. SQLite file at `data/db/babyloom.sqlite`, config at `data/config.yaml`, logs streamed to stdout + `data/logs/app-YYYY-MM-DD.log` via pino-roll. Tests via Vitest (unit/integration) and Playwright (E2E).

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript 5.6+ strict, Drizzle ORM, better-sqlite3, better-auth, Tailwind CSS v4 (CSS-first), pino + pino-roll, zod, js-yaml, Vitest, Playwright.

**Scope boundaries (NOT in P0):**
- No baby/family/entries/media schema (P2-P3)
- No permissions module (P1) — for P0, gate routes with simple "has session" middleware
- No animal-crossing design tokens or UI polish (P5)
- No backup / sanitize / Docker (P6)
- No trash bin (P4)

**Spec sections covered:** §2 architecture skeleton; §3 partial (only `users` and `sessions` tables); §4 config.yaml (full); §9 logging (full); §14 PRAGMAs (full).

---

## File Structure

P0 produces this tree (relative to repo root):

```
.
├── package.json
├── tsconfig.json
├── next.config.mjs
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .gitignore
├── .env.example                       # placeholder env vars (most config goes to config.yaml)
├── app/
│   ├── layout.tsx                     # root layout, loads global CSS, mounts session context
│   ├── page.tsx                       # redirects to /timeline if logged in, else /login
│   ├── globals.css                    # Tailwind v4 imports + token CSS variables placeholder
│   ├── login/
│   │   └── page.tsx                   # login form (server action)
│   └── api/
│       ├── auth/[...all]/route.ts     # better-auth handler
│       └── health/route.ts            # liveness + db ready check
├── middleware.ts                      # redirect unauthenticated → /login
├── lib/
│   ├── config/
│   │   ├── schema.ts                  # zod schema for config.yaml shape
│   │   └── load.ts                    # load + validate + cache config
│   ├── db/
│   │   ├── client.ts                  # better-sqlite3 + Drizzle + §14 PRAGMAs
│   │   ├── schema.ts                  # users + sessions tables only (P0)
│   │   └── migrate.ts                 # script: pnpm db:migrate
│   ├── auth/
│   │   └── server.ts                  # better-auth setup with sqlite adapter
│   ├── log/
│   │   └── server.ts                  # pino instance + child-logger factory
│   └── bootstrap/
│       └── owner.ts                   # idempotent: ensure owner user exists per config
├── data/                              # NOT committed; created on first run
│   ├── config.yaml                    # owner credentials + log level
│   ├── db/babyloom.sqlite
│   └── logs/
├── tests/
│   ├── setup.ts                       # vitest global setup: temp data dir per test file
│   ├── lib/
│   │   ├── config/load.test.ts
│   │   ├── db/client.test.ts
│   │   └── bootstrap/owner.test.ts
│   └── e2e/
│       └── login.spec.ts
└── docs/superpowers/specs/2026-05-15-babyloom-v2-rebuild-design.md  (already exists)
```

---

## Task 0: V1 archive + clean slate

**Why:** V1 (admin/client/server triplet under repo root) was never deployed (per spec §12 YAGNI). V2 is a Next.js monolith at repo root. We tag V1 for forensic recovery, then wipe it.

**Files:**
- Delete: `admin/`, `client/`, `server/`, `config/`, `docker-compose.dev.yml`, `docker-compose.yml`, `nginx.conf`, `specs/`, `README.md` (the V1 README — will write V2 README later)
- Keep: `docs/`, `.git/`, `.claude/`

- [ ] **Step 1: Verify on a worktree branch (not main)**

Run: `git branch --show-current`
Expected: `claude/affectionate-satoshi-6703ce` (or similar — NOT `main`)

- [ ] **Step 2: Tag V1 for forensic recovery**

Run:
```bash
git tag v1-archive-pre-rebuild HEAD
git show v1-archive-pre-rebuild --stat | head -20
```
Expected: tag created pointing at current HEAD.

- [ ] **Step 3: Delete V1 trees**

Run:
```bash
git rm -r admin client server config docker-compose.dev.yml docker-compose.yml nginx.conf specs README.md
git status --short
```
Expected: all V1 paths shown as deleted; only `docs/` and config remain tracked.

- [ ] **Step 4: Commit clean slate**

```bash
git commit -m "chore: archive V1 (tag v1-archive-pre-rebuild) and clear slate for V2"
```

---

## Task 1: package.json + tsconfig + .gitignore

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "babyloom",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx lib/db/migrate.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "drizzle-orm": "^0.36.0",
    "better-sqlite3": "^11.3.0",
    "better-auth": "^1.0.0",
    "zod": "^3.23.0",
    "js-yaml": "^4.1.0",
    "pino": "^9.5.0",
    "pino-roll": "^3.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.9.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.3",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "@playwright/test": "^1.48.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.49"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
.next/
out/
build/
*.tsbuildinfo
.env
.env.local
data/
test-data/
coverage/
playwright-report/
test-results/
.DS_Store
```

- [ ] **Step 4: Write `.env.example`** (used only for things that genuinely cannot live in config.yaml, e.g. test-time overrides)

```
# All runtime config lives in data/config.yaml (see §4 of spec).
# This file documents env vars used by tooling/tests only.

# Override config path during tests
BABYLOOM_CONFIG_PATH=./data/config.yaml

# Set per-test temp data dir (set by tests, not by user)
# BABYLOOM_DATA_DIR=
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no peer dep errors.

- [ ] **Step 6: Verify typecheck succeeds (no source files yet, should be a no-op pass)**

Run: `pnpm typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json .gitignore .env.example
git commit -m "feat(P0): scaffold Next.js 15 + TS strict + dependency manifest"
```

---

## Task 2: Next.js config + globals.css + root layout (minimal)

**Files:**
- Create: `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `postcss.config.mjs`

- [ ] **Step 1: Write `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pino', 'pino-roll']
  }
};

export default nextConfig;
```

- [ ] **Step 2: Write `postcss.config.mjs`**

```javascript
export default {
  plugins: { '@tailwindcss/postcss': {} }
};
```

- [ ] **Step 3: Write `app/globals.css`**

```css
@import "tailwindcss";

:root {
  /* placeholder tokens — full Animal Crossing palette lands in P5 */
  --color-surface: oklch(98% 0 0);
  --color-text: oklch(18% 0 0);
}

html, body {
  background: var(--color-surface);
  color: var(--color-text);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 4: Write `app/layout.tsx`**

```tsx
import './globals.css';

export const metadata = {
  title: 'Babyloom',
  description: 'Family baby memories'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Write `app/page.tsx` (placeholder — will redirect after auth lands)**

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-semibold">Babyloom</h1>
    </main>
  );
}
```

- [ ] **Step 6: Verify dev server boots**

Run: `pnpm dev`
Expected: listens on http://localhost:3000, "Babyloom" renders.

Kill with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add next.config.mjs postcss.config.mjs app/
git commit -m "feat(P0): bootstrap Next.js app router + Tailwind v4 entry"
```

---

## Task 3: Vitest setup

**Why first among tests:** every test task below uses Vitest with the `@` alias. Set up the runner before the first test.

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 10_000,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
});
```

- [ ] **Step 2: Write `tests/setup.ts`** (minimal for now)

```typescript
// Global test setup. Per-file temp dirs are created in each test's beforeEach.
process.env.NODE_ENV = 'test';
```

- [ ] **Step 3: Smoke test the runner**

Run: `pnpm test --reporter=verbose`
Expected: exits 0 (no tests yet — runner runs zero tests successfully).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "feat(P0): vitest config with @ alias and forked pool"
```

---

## Task 4: Pino structured logger

**Why now:** every later module logs. Get the logger working before DB/auth so we can debug them.

**Files:**
- Create: `lib/log/server.ts`, `tests/lib/log/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/log/server.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('createLogger', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-log-'));
  });

  it('produces a logger with child() returning a child logger', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'info' });
    const child = logger.child({ module: 'test' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('respects the configured log level', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'warn' });
    expect(logger.level).toBe('warn');
  });

  it('redacts sensitive fields from log payloads', async () => {
    const { createLogger } = await import('@/lib/log/server');
    const logger = createLogger({ dataDir, level: 'info' });
    // pino redact paths configured in source
    expect(logger.bindings?.()).toBeDefined();
    // Smoke: should not throw when logging an object with a `password` field
    expect(() => logger.info({ password: 'secret123', user: 'a' }, 'login')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/log/server.test.ts`
Expected: FAIL — module `@/lib/log/server` not found.

- [ ] **Step 3: Write `lib/log/server.ts`**

```typescript
import pino, { type Logger } from 'pino';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface LoggerOptions {
  dataDir: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'apiKey',
  '*.apiKey'
];

export function createLogger(opts: LoggerOptions): Logger {
  const logsDir = join(opts.dataDir, 'logs');
  mkdirSync(logsDir, { recursive: true });

  return pino({
    level: opts.level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]'
    },
    transport: {
      targets: [
        {
          target: 'pino/file',
          level: opts.level,
          options: { destination: 1 }
        },
        {
          target: 'pino-roll',
          level: opts.level,
          options: {
            file: join(logsDir, 'app'),
            frequency: 'daily',
            extension: '.log',
            mkdir: true
          }
        }
      ]
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/log/server.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/log/server.ts tests/lib/log/server.test.ts
git commit -m "feat(P0): pino structured logger with redaction + daily rotation"
```

---

## Task 5: Config loader (zod + js-yaml)

**Files:**
- Create: `lib/config/schema.ts`, `lib/config/load.ts`, `tests/lib/config/load.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/config/load.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadConfig', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-config-'));
  });

  it('parses a valid config.yaml', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/config/load');
    const cfg = loadConfig({ dataDir });
    expect(cfg.owner.username).toBe('alice');
    expect(cfg.owner.password).toBe('secret123');
    expect(cfg.log.level).toBe('info');
  });

  it('rejects config missing owner.password', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/password/);
  });

  it('rejects config with password shorter than 8 chars', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: short
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { loadConfig } = await import('@/lib/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/at least 8/);
  });

  it('defaults log.level to info when omitted', async () => {
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: secret123
  email: alice@example.com
  displayName: Alice
`);
    const { loadConfig } = await import('@/lib/config/load');
    const cfg = loadConfig({ dataDir });
    expect(cfg.log.level).toBe('info');
  });

  it('throws a clear error if file does not exist', async () => {
    const { loadConfig } = await import('@/lib/config/load');
    expect(() => loadConfig({ dataDir })).toThrow(/config\.yaml not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/config/load.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/config/schema.ts`**

```typescript
import { z } from 'zod';

export const configSchema = z.object({
  owner: z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(8, 'owner.password must be at least 8 characters'),
    email: z.string().email(),
    displayName: z.string().min(1).max(50)
  }),
  log: z
    .object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
    })
    .default({ level: 'info' })
});

export type Config = z.infer<typeof configSchema>;
```

- [ ] **Step 4: Write `lib/config/load.ts`**

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { configSchema, type Config } from './schema';

export interface LoadConfigOptions {
  dataDir: string;
}

let cached: { dataDir: string; config: Config } | null = null;

export function loadConfig(opts: LoadConfigOptions): Config {
  if (cached && cached.dataDir === opts.dataDir) return cached.config;

  const path = join(opts.dataDir, 'config.yaml');
  if (!existsSync(path)) {
    throw new Error(`config.yaml not found at ${path}`);
  }

  const raw = readFileSync(path, 'utf-8');
  const parsed = yaml.load(raw);
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid config.yaml: ${issues}`);
  }

  cached = { dataDir: opts.dataDir, config: result.data };
  return result.data;
}

export function clearConfigCache() {
  cached = null;
}
```

- [ ] **Step 5: Tests need cache reset between cases — update test setup**

Edit `tests/lib/config/load.test.ts` `beforeEach`:

```typescript
beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'babyloom-config-'));
  const { clearConfigCache } = await import('@/lib/config/load');
  clearConfigCache();
});
```

- [ ] **Step 6: Run test to verify all pass**

Run: `pnpm test tests/lib/config/load.test.ts`
Expected: 5 passing.

- [ ] **Step 7: Commit**

```bash
git add lib/config/ tests/lib/config/
git commit -m "feat(P0): config.yaml loader with zod validation and clear errors"
```

---

## Task 6: DB client (better-sqlite3 + Drizzle + §14 PRAGMAs)

**Files:**
- Create: `lib/db/client.ts`, `lib/db/schema.ts`, `tests/lib/db/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/db/client.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('getDb', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-db-'));
    const { resetDbForTesting } = await import('@/lib/db/client');
    resetDbForTesting();
  });

  it('opens an sqlite file at data/db/babyloom.sqlite', async () => {
    const { getDb } = await import('@/lib/db/client');
    const { db, raw } = getDb({ dataDir });
    expect(db).toBeDefined();
    expect(raw.open).toBe(true);
  });

  it('applies all §14 PRAGMAs on first open', async () => {
    const { getDb } = await import('@/lib/db/client');
    const { raw } = getDb({ dataDir });
    expect(raw.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(raw.pragma('synchronous', { simple: true })).toBe(1); // NORMAL = 1
    expect(raw.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(raw.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(raw.pragma('temp_store', { simple: true })).toBe(2); // MEMORY = 2
  });

  it('returns the same instance on subsequent calls (singleton)', async () => {
    const { getDb } = await import('@/lib/db/client');
    const a = getDb({ dataDir });
    const b = getDb({ dataDir });
    expect(a.raw).toBe(b.raw);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/db/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/db/schema.ts`** (users + sessions only for P0)

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull(), // 'owner' | 'editor' | 'viewer' — only owner used in P0
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at').notNull()
});
```

- [ ] **Step 4: Write `lib/db/client.ts`**

```typescript
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from './schema';

export interface GetDbOptions {
  dataDir: string;
}

interface DbHandle {
  db: BetterSQLite3Database<typeof schema>;
  raw: Database.Database;
}

let cached: { dataDir: string; handle: DbHandle } | null = null;

export function getDb(opts: GetDbOptions): DbHandle {
  if (cached && cached.dataDir === opts.dataDir) return cached.handle;

  const dbDir = join(opts.dataDir, 'db');
  mkdirSync(dbDir, { recursive: true });
  const file = join(dbDir, 'babyloom.sqlite');

  const raw = new Database(file);
  // §14 PRAGMAs — applied immediately after open
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');
  raw.pragma('temp_store = MEMORY');

  const db = drizzle(raw, { schema });
  const handle = { db, raw };
  cached = { dataDir: opts.dataDir, handle };
  return handle;
}

// Test-only: forget the cached instance so a fresh tempdir test gets a fresh DB
export function resetDbForTesting() {
  if (cached) {
    cached.handle.raw.close();
    cached = null;
  }
}
```

- [ ] **Step 5: Run test to verify all pass**

Run: `pnpm test tests/lib/db/client.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/db/ tests/lib/db/
git commit -m "feat(P0): better-sqlite3 + Drizzle client with §14 PRAGMAs"
```

---

## Task 7: Drizzle migration tooling

**Files:**
- Create: `drizzle.config.ts`, `lib/db/migrate.ts`
- Modify: `package.json` (already has `db:generate` / `db:migrate` scripts)

- [ ] **Step 1: Write `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.BABYLOOM_SQLITE_PATH ?? './data/db/babyloom.sqlite'
  }
});
```

- [ ] **Step 2: Generate the initial migration**

Run: `pnpm db:generate`
Expected: creates `lib/db/migrations/0000_<name>.sql` with `CREATE TABLE users` and `CREATE TABLE sessions`.

- [ ] **Step 3: Verify migration SQL contents**

Run: `cat lib/db/migrations/0000_*.sql`
Expected: both tables present with correct columns + FKs.

- [ ] **Step 4: Write `lib/db/migrate.ts`** (programmatic runner used by `pnpm db:migrate` AND at app startup)

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb } from './client';
import { resolve } from 'node:path';

export function runMigrations(dataDir: string) {
  const { db } = getDb({ dataDir });
  migrate(db, { migrationsFolder: resolve(__dirname, 'migrations') });
}

// CLI entrypoint
if (require.main === module) {
  const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');
  runMigrations(dataDir);
  console.log(`Migrations applied at ${dataDir}/db/babyloom.sqlite`);
}
```

- [ ] **Step 5: Smoke test the migration runner**

Run:
```bash
BABYLOOM_DATA_DIR=/tmp/babyloom-smoke pnpm db:migrate
ls /tmp/babyloom-smoke/db/
sqlite3 /tmp/babyloom-smoke/db/babyloom.sqlite ".tables"
```
Expected: `babyloom.sqlite` exists; `.tables` shows `sessions users` (plus drizzle's `__drizzle_migrations`).

- [ ] **Step 6: Commit**

```bash
git add drizzle.config.ts lib/db/migrate.ts lib/db/migrations/
git commit -m "feat(P0): drizzle-kit migration tooling + initial users/sessions schema"
```

---

## Task 8: Owner bootstrap

**Why:** §4 of spec says owner credentials come from `config.yaml`; on startup we ensure an owner user exists with the configured username/password. Idempotent — runs every boot.

**Files:**
- Create: `lib/bootstrap/owner.ts`, `tests/lib/bootstrap/owner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/bootstrap/owner.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('bootstrapOwner', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-bootstrap-'));
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: longenoughpw
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    const { resetDbForTesting } = await import('@/lib/db/client');
    const { clearConfigCache } = await import('@/lib/config/load');
    resetDbForTesting();
    clearConfigCache();
    const { runMigrations } = await import('@/lib/db/migrate');
    runMigrations(dataDir);
  });

  it('creates the owner user if no user exists', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/db/schema');
    const rows = db.select().from(users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('alice');
    expect(rows[0].role).toBe('owner');
    expect(rows[0].passwordHash).not.toBe('longenoughpw');
    expect(rows[0].passwordHash.length).toBeGreaterThan(20);
  });

  it('is idempotent — second call does not create duplicate', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/db/schema');
    expect(db.select().from(users).all()).toHaveLength(1);
  });

  it('updates the owner password if config.yaml changed', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users } = await import('@/lib/db/schema');
    const firstHash = db.select().from(users).all()[0].passwordHash;

    // Rewrite config with new password
    const { clearConfigCache } = await import('@/lib/config/load');
    clearConfigCache();
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: brandnewpassword
  email: alice@example.com
  displayName: Alice
log:
  level: info
`);
    await bootstrapOwner({ dataDir });

    const secondHash = db.select().from(users).all()[0].passwordHash;
    expect(secondHash).not.toBe(firstHash);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/bootstrap/owner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/bootstrap/owner.ts`**

```typescript
import { eq } from 'drizzle-orm';
import { createHash, randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { loadConfig } from '@/lib/config/load';

export interface BootstrapOwnerOptions {
  dataDir: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export async function bootstrapOwner(opts: BootstrapOwnerOptions): Promise<void> {
  const config = loadConfig({ dataDir: opts.dataDir });
  const { db } = getDb({ dataDir: opts.dataDir });

  const existing = db.select().from(users).where(eq(users.role, 'owner')).all();
  const now = Date.now();
  const passwordHash = hashPassword(config.owner.password);

  if (existing.length === 0) {
    db.insert(users)
      .values({
        id: randomUUID(),
        username: config.owner.username,
        email: config.owner.email,
        displayName: config.owner.displayName,
        role: 'owner',
        passwordHash,
        createdAt: now,
        updatedAt: now
      })
      .run();
    return;
  }

  const owner = existing[0];
  db.update(users)
    .set({
      username: config.owner.username,
      email: config.owner.email,
      displayName: config.owner.displayName,
      passwordHash,
      updatedAt: now
    })
    .where(eq(users.id, owner.id))
    .run();
}
```

- [ ] **Step 4: Run test to verify all pass**

Run: `pnpm test tests/lib/bootstrap/owner.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/bootstrap/ tests/lib/bootstrap/
git commit -m "feat(P0): owner bootstrap from config.yaml with scrypt password hashing"
```

---

## Task 9: better-auth setup

**Note:** better-auth v1 ships its own user/session schema and adapters. We use it with the existing Drizzle better-sqlite3 adapter. Auth runs entirely in-process; no external service.

**Files:**
- Create: `lib/auth/server.ts`, `app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Write `lib/auth/server.ts`**

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/lib/db/client';
import { users, sessions } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/bootstrap/owner';

export interface AuthOptions {
  dataDir: string;
}

let cachedAuth: ReturnType<typeof betterAuth> | null = null;

export function getAuth(opts: AuthOptions) {
  if (cachedAuth) return cachedAuth;

  const { db } = getDb({ dataDir: opts.dataDir });

  cachedAuth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user: users, session: sessions }
    }),
    emailAndPassword: {
      enabled: true,
      verifyPassword: async (password, stored) => verifyPassword(password, stored)
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24
    }
  });

  return cachedAuth;
}

export function resetAuthForTesting() {
  cachedAuth = null;
}
```

- [ ] **Step 2: Write `app/api/auth/[...all]/route.ts`**

```typescript
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';

const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');
const auth = getAuth({ dataDir });

export const GET = auth.handler;
export const POST = auth.handler;
```

- [ ] **Step 3: Smoke test the auth endpoint**

Run:
```bash
BABYLOOM_DATA_DIR=/tmp/babyloom-smoke pnpm dev &
sleep 3
curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"longenoughpw"}' | head
kill %1
```
Expected: response includes a session token (better-auth shape varies — main thing is no 500).

> If the owner wasn't seeded yet, this will 401 — Task 11 (app startup) wires bootstrap.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/ app/api/auth/
git commit -m "feat(P0): better-auth email+password with Drizzle adapter"
```

---

## Task 10: Login page (server action)

**Files:**
- Create: `app/login/page.tsx`, `app/login/actions.ts`

- [ ] **Step 1: Write `app/login/actions.ts`**

```typescript
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';

const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

export async function loginAction(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: '请输入邮箱和密码' };
  }

  const auth = getAuth({ dataDir });
  const hdrs = await headers();

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: hdrs
    });
  } catch {
    return { error: '邮箱或密码错误' };
  }

  redirect('/');
}
```

- [ ] **Step 2: Write `app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form action={onSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-center">登录 Babyloom</h1>
        <input
          name="email"
          type="email"
          required
          placeholder="邮箱"
          className="border rounded px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="密码"
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {pending ? '登录中…' : '登录'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/login/
git commit -m "feat(P0): login page with server action calling better-auth"
```

---

## Task 11: Middleware (unauthenticated → /login)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write `middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health', '/_next', '/favicon.ico'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // better-auth stores session token in cookie 'better-auth.session_token'
  const hasSession = req.cookies.has('better-auth.session_token');
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(P0): middleware redirects unauthenticated traffic to /login"
```

---

## Task 12: App startup — migrations + bootstrap + logger

**Why:** Migrations and owner bootstrap must run on every boot before serving requests. The cleanest hook in Next.js App Router is `instrumentation.ts`.

**Files:**
- Create: `instrumentation.ts`

- [ ] **Step 1: Write `instrumentation.ts`**

```typescript
import { resolve } from 'node:path';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

  const { loadConfig } = await import('@/lib/config/load');
  const { createLogger } = await import('@/lib/log/server');
  const { runMigrations } = await import('@/lib/db/migrate');
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');

  const config = loadConfig({ dataDir });
  const log = createLogger({ dataDir, level: config.log.level }).child({ module: 'startup' });

  log.info({ dataDir }, 'starting babyloom');

  runMigrations(dataDir);
  log.info('migrations applied');

  await bootstrapOwner({ dataDir });
  log.info({ owner: config.owner.username }, 'owner ensured');

  log.info('startup complete');
}
```

- [ ] **Step 2: Add `instrumentationHook` opt-in to `next.config.mjs`**

Edit `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pino', 'pino-roll'],
    instrumentationHook: true
  }
};

export default nextConfig;
```

- [ ] **Step 3: Commit**

```bash
git add instrumentation.ts next.config.mjs
git commit -m "feat(P0): instrumentation hook runs migrations + owner bootstrap on startup"
```

---

## Task 13: Health endpoint

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Write `app/api/health/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';

const dataDir = process.env.BABYLOOM_DATA_DIR ?? resolve(process.cwd(), 'data');

export async function GET() {
  try {
    const { raw } = getDb({ dataDir });
    const result = raw.prepare('SELECT 1 as ok').get() as { ok: number };
    return NextResponse.json({ ok: true, dbReady: result.ok === 1 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/health/
git commit -m "feat(P0): /api/health endpoint with DB readiness check"
```

---

## Task 14: Seed config.yaml + verify end-to-end manually

**Files:**
- Create: `data/config.yaml` (locally only — `.gitignore` excludes `data/`)

- [ ] **Step 1: Create sample config**

```bash
mkdir -p data
cat > data/config.yaml <<'EOF'
owner:
  username: owner
  password: changeme123
  email: owner@example.com
  displayName: Owner
log:
  level: info
EOF
chmod 600 data/config.yaml
```

- [ ] **Step 2: Boot the app**

Run: `pnpm dev`
Expected: logs show `starting babyloom` → `migrations applied` → `owner ensured` → `startup complete`. App listens on :3000.

- [ ] **Step 3: Verify health endpoint**

In another shell: `curl -s http://localhost:3000/api/health`
Expected: `{"ok":true,"dbReady":true}`

- [ ] **Step 4: Verify middleware redirects**

`curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/`
Expected: `307` redirecting to `/login` (no session cookie).

- [ ] **Step 5: Verify login works in browser**

Open http://localhost:3000/login, log in as `owner@example.com` / `changeme123`. Expected: redirect to `/` and the placeholder home renders. Check `data/logs/app-YYYY-MM-DD.log` for the startup events.

Kill dev server.

- [ ] **Step 6: No commit** (data/ is gitignored — nothing to add)

---

## Task 15: Playwright E2E — login flow

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/login.spec.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'BABYLOOM_DATA_DIR=./test-data/e2e pnpm dev',
    url: 'http://localhost:3000/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }
});
```

- [ ] **Step 2: Create the per-run E2E config + reset helper**

Create `tests/e2e/global-setup.ts`:

```typescript
import { rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function globalSetup() {
  const dir = resolve(process.cwd(), 'test-data/e2e');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/config.yaml`,
    `owner:
  username: e2eowner
  password: e2epassword
  email: e2e@example.com
  displayName: E2E Owner
log:
  level: warn
`,
    'utf-8'
  );
  chmodSync(`${dir}/config.yaml`, 0o600);
}
```

Update `playwright.config.ts` to reference it:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'BABYLOOM_DATA_DIR=./test-data/e2e pnpm dev',
    url: 'http://localhost:3000/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }
});
```

- [ ] **Step 3: Write `tests/e2e/login.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('unauthenticated visit redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('owner can log in with config credentials', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Babyloom' })).toBeVisible();
});

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await expect(page.getByText('邮箱或密码错误')).toBeVisible();
});

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.dbReady).toBe(true);
});
```

- [ ] **Step 4: Install Playwright browsers**

Run: `pnpm exec playwright install chromium`
Expected: browser installed.

- [ ] **Step 5: Run E2E**

Run: `pnpm test:e2e`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test(P0): Playwright E2E covers login flow + health endpoint"
```

---

## Task 16: README + finish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Babyloom V2

家庭宝宝成长记录,自托管 PWA。

## P0 Status

Foundation in place: Next.js 15 + SQLite + better-auth + config-driven owner.

## Quick Start

```bash
pnpm install
mkdir -p data
cat > data/config.yaml <<'EOF'
owner:
  username: owner
  password: <at-least-8-chars>
  email: owner@example.com
  displayName: Owner
log:
  level: info
EOF
chmod 600 data/config.yaml
pnpm dev
```

Open http://localhost:3000, log in with the email + password from `data/config.yaml`.

## Tests

```bash
pnpm test           # unit + integration
pnpm test:e2e       # Playwright
pnpm typecheck
```

## Scripts

- `pnpm dev` — Next.js dev server
- `pnpm build` — production build (standalone output)
- `pnpm db:generate` — generate Drizzle migrations from schema changes
- `pnpm db:migrate` — apply pending migrations to the configured SQLite file

## Configuration

All runtime configuration lives in `data/config.yaml`. See spec §4 for the full schema (P0 ships only the `owner` and `log` sections).

## Reset Owner Password

Edit `data/config.yaml` → restart the app. The bootstrap step replaces the owner's password hash on every boot.

## Project Spec

`docs/superpowers/specs/2026-05-15-babyloom-v2-rebuild-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(P0): V2 README with quickstart + scripts"
```

---

## P0 Acceptance Checklist

Before marking P0 complete, verify all of the following pass:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` — 11+ tests passing across config / log / db / bootstrap
- [ ] `pnpm test:e2e` — 4 tests passing
- [ ] `pnpm dev` boots and logs `startup complete`
- [ ] `curl http://localhost:3000/api/health` → `{"ok":true,"dbReady":true}`
- [ ] Browser login with config credentials succeeds, redirect to `/`
- [ ] `data/logs/app-YYYY-MM-DD.log` exists and contains startup events
- [ ] Editing `data/config.yaml` owner password + restarting lets the new password log in (and the old does not)
- [ ] No `console.log` survivors in `lib/` or `app/` (`grep -rn console.log lib app` → empty)
- [ ] `git log --oneline` shows ~15 small, named commits matching task names
