import { z } from 'zod';
import { isValidTimeZone } from '@/lib/shared/format-time';

export const configSchema = z.object({
  owner: z.object({
    username: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/, 'owner.username may only contain letters, numbers, _ and -'),
    password: z.string().min(6, 'owner.password must be at least 6 characters'),
    nickname: z.string().min(1).max(50)
  }),
  family: z.object({
    name: z.string().min(1).max(80)
  }),
  app: z.object({
    baseUrl: z.string().url().default('http://localhost:3000'),
    secret: z.string().min(32, 'app.secret must be at least 32 characters'),
    // Validated once here so every consumer (layout, calendar, timeline date
    // filtering) gets a tz that won't make Intl throw at render time.
    timezone: z
      .string()
      .min(1)
      .default('Asia/Shanghai')
      .refine(isValidTimeZone, { message: 'app.timezone must be a valid IANA timezone, e.g. Asia/Shanghai' })
  }),
  log: z
    .object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
    })
    .default({ level: 'info' }),
  media: z
    .object({
      maxPhotoBytes: z.number().int().positive().default(50_000_000),
      maxVideoBytes: z.number().int().positive().default(500_000_000)
    })
    .default({ maxPhotoBytes: 50_000_000, maxVideoBytes: 500_000_000 })
});

export type Config = z.infer<typeof configSchema>;
