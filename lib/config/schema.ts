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
