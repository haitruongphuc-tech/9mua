import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL là bắt buộc' })
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL phải là chuỗi kết nối PostgreSQL'),
    APP_URL: z.url().optional(),
    // Chỉ đặt khi chạy E2E (Playwright). KHÔNG BAO GIỜ đặt trên VPS.
    TEST_MODE: z.enum(['e2e']).optional(),
    MAIL_DRIVER: z.enum(['smtp', 'console', 'memory', 'file']).optional(),
    MAIL_OUTBOX_DIR: z.string().default('test-results/mail'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('9MUA <no-reply@9mua.com>'),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && !v.APP_URL) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'APP_URL là bắt buộc ở production' });
    }
    const driver = mailDriver(v);
    if (v.NODE_ENV === 'production' && !v.TEST_MODE && (driver === 'memory' || driver === 'file')) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_DRIVER'],
        message: `MAIL_DRIVER=${driver} không được dùng ở production`,
      });
    }
    if (driver === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const) {
        if (!v[key])
          ctx.addIssue({ code: 'custom', path: [key], message: `${key} là bắt buộc khi gửi mail qua SMTP` });
      }
    }
  })
  .transform((v) => {
    const appUrl = (v.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return { ...v, MAIL_DRIVER: mailDriver(v), APP_URL: appUrl, ROOT_DOMAIN: new URL(appUrl).hostname };
  });

// Production gửi thật qua SMTP (Brevo); dev in ra console; test bỏ vào hộp thư giả.
function mailDriver(v: { NODE_ENV: string; MAIL_DRIVER?: 'smtp' | 'console' | 'memory' | 'file' }) {
  if (v.MAIL_DRIVER) return v.MAIL_DRIVER;
  return v.NODE_ENV === 'production' ? 'smtp' : v.NODE_ENV === 'test' ? 'memory' : 'console';
}

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
