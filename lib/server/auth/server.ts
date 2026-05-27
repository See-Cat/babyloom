import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from '@/lib/server/db/client';
import { users, sessions, accounts, verifications } from '@/lib/server/db/schema';
import { hashPassword, verifyPassword } from '@/lib/server/bootstrap/owner';
import { loadConfig } from '@/lib/server/config/load';

export interface AuthOptions {
  dataDir: string;
}

function createAuth(opts: AuthOptions) {
  const { db } = getDb({ dataDir: opts.dataDir });
  const config = loadConfig({ dataDir: opts.dataDir });

  return betterAuth({
    baseURL: config.app.baseUrl,
    secret: config.app.secret,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user: users, session: sessions, account: accounts, verification: verifications }
    }),
    emailAndPassword: {
      enabled: true,
      password: {
        hash: async (password) => hashPassword(password),
        verify: async ({ hash, password }) => verifyPassword(password, hash)
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24
    },
    plugins: [nextCookies()]
  });
}

let cachedAuth: { dataDir: string; auth: ReturnType<typeof createAuth> } | null = null;

export function getAuth(opts: AuthOptions) {
  if (cachedAuth && cachedAuth.dataDir === opts.dataDir) return cachedAuth.auth;
  const auth = createAuth(opts);
  cachedAuth = { dataDir: opts.dataDir, auth };
  return auth;
}

export function resetAuthForTesting() {
  cachedAuth = null;
}
