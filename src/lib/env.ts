import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL là bắt buộc' })
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL phải là chuỗi kết nối PostgreSQL'),
    APP_URL: z.url().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && !v.APP_URL) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'APP_URL là bắt buộc ở production' });
    }
  })
  .transform((v) => {
    const appUrl = (v.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return { ...v, APP_URL: appUrl, ROOT_DOMAIN: new URL(appUrl).hostname };
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${lines.join('\n')}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
