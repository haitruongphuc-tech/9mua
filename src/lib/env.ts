import path from 'node:path';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL là bắt buộc' })
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL phải là chuỗi kết nối PostgreSQL'),
    APP_URL: z.url().optional(),
    // Ảnh/video công khai (Nginx phục vụ /uploads) và file riêng tư (ảnh CCCD) — tuyệt đối trong Docker.
    UPLOAD_DIR: z
      .string()
      .default('data/uploads')
      .transform((p) => path.resolve(p)),
    PRIVATE_DIR: z
      .string()
      .default('data/private')
      .transform((p) => path.resolve(p)),
    // Chỉ đặt khi chạy E2E (Playwright). KHÔNG BAO GIỜ đặt trên VPS.
    TEST_MODE: z.enum(['e2e']).optional(),
    MAIL_DRIVER: z.enum(['smtp', 'console', 'memory', 'file']).optional(),
    MAIL_OUTBOX_DIR: z.string().default('test-results/mail'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('9MUA <no-reply@9mua.com>'),
    // Thanh toán (SPEC-payments.md). Driver fake chỉ cho dev/test/E2E.
    PAYMENTS_DRIVER: z.enum(['payos', 'fake']).optional(),
    PAYOS_CLIENT_ID: z.string().optional(),
    PAYOS_API_KEY: z.string().optional(),
    PAYOS_CHECKSUM_KEY: z.string().optional(),
    // Kênh chi hộ (Payout) của PayOS có bộ khoá riêng. Chưa có thì mọi yêu cầu rút vào hàng chờ duyệt tay.
    PAYOS_PAYOUT_CLIENT_ID: z.string().optional(),
    PAYOS_PAYOUT_API_KEY: z.string().optional(),
    PAYOS_PAYOUT_CHECKSUM_KEY: z.string().optional(),
    // Token bí mật cho cron gọi /api/internal/* (Docker che IP người gọi nên không dựa vào IP).
    INTERNAL_CRON_TOKEN: z.string().optional(),
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
    const payments = paymentsDriver(v);
    if (v.NODE_ENV === 'production' && !v.TEST_MODE && payments === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENTS_DRIVER'],
        message: 'PAYMENTS_DRIVER=fake không được dùng ở production',
      });
    }
    if (payments === 'payos') {
      for (const key of ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'] as const) {
        if (!v[key])
          ctx.addIssue({ code: 'custom', path: [key], message: `${key} là bắt buộc khi dùng PayOS` });
      }
    }
    const payoutKeys = [
      'PAYOS_PAYOUT_CLIENT_ID',
      'PAYOS_PAYOUT_API_KEY',
      'PAYOS_PAYOUT_CHECKSUM_KEY',
    ] as const;
    if (payoutKeys.some((k) => v[k]) && !payoutKeys.every((k) => v[k])) {
      for (const key of payoutKeys.filter((k) => !v[k]))
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} thiếu: cần đủ 3 khoá kênh chi hộ PayOS`,
        });
    }
    if (v.NODE_ENV === 'production' && (v.INTERNAL_CRON_TOKEN ?? '').length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['INTERNAL_CRON_TOKEN'],
        message: 'INTERNAL_CRON_TOKEN cần ít nhất 32 ký tự ở production',
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
    return {
      ...v,
      MAIL_DRIVER: mailDriver(v),
      PAYMENTS_DRIVER: paymentsDriver(v),
      PAYOS_CHECKSUM_KEY: v.PAYOS_CHECKSUM_KEY ?? (paymentsDriver(v) === 'fake' ? FAKE_CHECKSUM_KEY : ''),
      APP_URL: appUrl,
      ROOT_DOMAIN: new URL(appUrl).hostname,
    };
  });

export const FAKE_CHECKSUM_KEY = 'fake-checksum-key-9mua';

function paymentsDriver(v: { NODE_ENV: string; PAYMENTS_DRIVER?: 'payos' | 'fake' }) {
  return v.PAYMENTS_DRIVER ?? (v.NODE_ENV === 'production' ? 'payos' : 'fake');
}

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
