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
    // Khoá AES-256 (64 ký tự hex) mã hoá bí mật TOTP của admin. Tạo: openssl rand -hex 32
    APP_ENCRYPTION_KEY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .regex(/^[0-9a-f]{64}$/i, 'APP_ENCRYPTION_KEY phải là 64 ký tự hex (openssl rand -hex 32)')
        .optional(),
    ),
    // Token bí mật cho cron gọi /api/internal/* (Docker che IP người gọi nên không dựa vào IP).
    INTERNAL_CRON_TOKEN: z.string().optional(),
    // Đăng nhập Google (SPEC-identity.md bổ sung 27/10). Để trống thì ẩn nút Google.
    GOOGLE_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    // Đăng nhập Zalo, Facebook (SPEC-identity.md bổ sung 29/10). Để trống thì ẩn nút.
    ZALO_APP_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    ZALO_APP_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    FACEBOOK_APP_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    FACEBOOK_APP_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    // Kho video ngoài chuẩn S3 (SPEC-creator.md V5.1 mục 9; Cloudflare R2: vùng "auto"). Thiếu khoá thì video lưu trên VPS.
    // Driver fake chỉ cho dev/test.
    STORAGE_DRIVER: z.enum(['s3', 'fake']).optional(),
    STORAGE_S3_ENDPOINT: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    STORAGE_S3_REGION: z.string().default('auto'),
    STORAGE_S3_BUCKET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    STORAGE_S3_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    STORAGE_S3_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    STORAGE_PUBLIC_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    // Live (SPEC-live.md): API nội bộ của MediaMTX (không mở ra Internet). Driver fake chỉ cho test/E2E.
    MEDIA_DRIVER: z.enum(['mediamtx', 'fake']).optional(),
    MEDIAMTX_API_URL: z.string().default('http://mediamtx:9997'),
    // AI Studio (SPEC-ai.md). Thiếu khoá thì phần tương ứng báo "Chưa bật". Driver fake chỉ cho dev/test/E2E.
    AI_DRIVER: z.enum(['live', 'fake']).optional(),
    ANTHROPIC_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    // Phụ đề tự động (SPEC-creator.md V5.4): openai = Whisper (OPENAI_API_KEY); fake chỉ cho dev/test.
    STT_PROVIDER: z.enum(['openai', 'fake']).optional(),
    OPENAI_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    GEMINI_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    AI_TEXT_MODEL: z.preprocess((v) => (v === '' ? undefined : v), z.string().default('claude-haiku-5-5')),
    AI_IMAGE_MODEL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().default('gemini-2.5-flash-image'),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && !v.APP_URL) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'APP_URL là bắt buộc ở production' });
    }
    // TEST_MODE mở cổng thanh toán giả và hộp thư giả — chỉ cho máy chạy E2E (http://9mua.test), không bao giờ
    // cho một địa chỉ HTTPS thật như https://9mua.com.
    if (v.TEST_MODE && v.APP_URL?.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_MODE'],
        message: 'TEST_MODE không được bật trên địa chỉ HTTPS thật',
      });
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
    if (v.NODE_ENV === 'production' && !v.TEST_MODE && !v.APP_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_ENCRYPTION_KEY'],
        message: 'APP_ENCRYPTION_KEY là bắt buộc ở production',
      });
    }
    if (v.NODE_ENV === 'production' && (v.INTERNAL_CRON_TOKEN ?? '').length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['INTERNAL_CRON_TOKEN'],
        message: 'INTERNAL_CRON_TOKEN cần ít nhất 32 ký tự ở production',
      });
    }
    if (v.NODE_ENV === 'production' && !v.TEST_MODE && mediaDriver(v) === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['MEDIA_DRIVER'],
        message: 'MEDIA_DRIVER=fake không được dùng ở production',
      });
    }
    if (v.NODE_ENV === 'production' && !v.TEST_MODE && aiDriver(v) === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_DRIVER'],
        message: 'AI_DRIVER=fake không được dùng ở production',
      });
    }
    if (Boolean(v.GOOGLE_CLIENT_ID) !== Boolean(v.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: [v.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_SECRET' : 'GOOGLE_CLIENT_ID'],
        message: 'Đăng nhập Google cần đủ cả GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET',
      });
    }
    for (const [id, secret, label] of [
      ['ZALO_APP_ID', 'ZALO_APP_SECRET', 'Zalo'],
      ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'Facebook'],
    ] as const) {
      if (Boolean(v[id]) !== Boolean(v[secret]))
        ctx.addIssue({
          code: 'custom',
          path: [v[id] ? secret : id],
          message: `Đăng nhập ${label} cần đủ cả ${id} và ${secret}`,
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
      AI_DRIVER: aiDriver(v),
      MEDIA_DRIVER: mediaDriver(v),
      PAYOS_CHECKSUM_KEY: v.PAYOS_CHECKSUM_KEY ?? (paymentsDriver(v) === 'fake' ? FAKE_CHECKSUM_KEY : ''),
      APP_URL: appUrl,
      // Dev/test/E2E dùng khoá cố định công khai; production bắt buộc khoá riêng (kiểm ở trên).
      APP_ENCRYPTION_KEY: v.APP_ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY,
      ROOT_DOMAIN: new URL(appUrl).hostname,
    };
  });

export const FAKE_CHECKSUM_KEY = 'fake-checksum-key-9mua';
const DEV_ENCRYPTION_KEY = '9a'.repeat(32);

function paymentsDriver(v: { NODE_ENV: string; PAYMENTS_DRIVER?: 'payos' | 'fake' }) {
  return v.PAYMENTS_DRIVER ?? (v.NODE_ENV === 'production' ? 'payos' : 'fake');
}

// Test và E2E dùng máy chủ hình giả (máy chạy test không có MediaMTX).
function mediaDriver(v: { NODE_ENV: string; TEST_MODE?: string; MEDIA_DRIVER?: 'mediamtx' | 'fake' }) {
  return v.MEDIA_DRIVER ?? (v.TEST_MODE || v.NODE_ENV === 'test' ? 'fake' : 'mediamtx');
}

// Test và E2E dùng AI giả (không tốn tiền, kết quả cố định); dev và production gọi thật nếu có khoá.
function aiDriver(v: { NODE_ENV: string; TEST_MODE?: string; AI_DRIVER?: 'live' | 'fake' }) {
  return v.AI_DRIVER ?? (v.TEST_MODE || v.NODE_ENV === 'test' ? 'fake' : 'live');
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

// Chỉ cho test: đọc lại biến môi trường sau vi.stubEnv.
export function resetEnvCache(): void {
  cached = undefined;
}
