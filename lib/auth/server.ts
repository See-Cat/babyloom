import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from '@/lib/db/client';
import { users, sessions, accounts, verifications } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/bootstrap/owner';

export interface AuthOptions {
  dataDir: string;
}

function createAuth(opts: AuthOptions) {
  const { db } = getDb({ dataDir: opts.dataDir });

  return betterAuth({
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

let cachedAuth: ReturnType<typeof createAuth> | null = null;

export function getAuth(opts: AuthOptions) {
  if (cachedAuth) return cachedAuth;
  cachedAuth = createAuth(opts);
  return cachedAuth;
}

export function resetAuthForTesting() {
  cachedAuth = null;
}
