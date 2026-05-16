import { z } from 'zod';

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
    timezone: z.string().min(1).default('Asia/Shanghai')
  }),
  log: z
    .object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
    })
    .default({ level: 'info' })
});

export type Config = z.infer<typeof configSchema>;
