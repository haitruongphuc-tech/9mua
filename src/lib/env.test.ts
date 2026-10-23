import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  APP_URL: 'https://9mua.com',
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  PAYOS_CLIENT_ID: 'id',
  PAYOS_API_KEY: 'key',
  PAYOS_CHECKSUM_KEY: 'checksum',
  INTERNAL_CRON_TOKEN: 'x'.repeat(32),
  APP_ENCRYPTION_KEY: 'ab'.repeat(32),
};

describe('parseEnv', () => {
  it('chấp nhận cấu hình hợp lệ', () => {
    const env = parseEnv(valid);
    expect(env.APP_URL).toBe('https://9mua.com');
    expect(env.ROOT_DOMAIN).toBe('9mua.com');
  });

  it('kênh chi hộ PayOS: để trống cả 3 khoá được, khai báo thiếu thì báo lỗi', () => {
    expect(() => parseEnv({ ...valid, PAYOS_PAYOUT_CLIENT_ID: '', PAYOS_PAYOUT_API_KEY: '' })).not.toThrow();
    expect(() => parseEnv({ ...valid, PAYOS_PAYOUT_CLIENT_ID: 'id' })).toThrow(/PAYOS_PAYOUT_API_KEY/);
    const keys = { PAYOS_PAYOUT_CLIENT_ID: 'a', PAYOS_PAYOUT_API_KEY: 'b', PAYOS_PAYOUT_CHECKSUM_KEY: 'c' };
    expect(() => parseEnv({ ...valid, ...keys })).not.toThrow();
  });

  it('production bắt buộc khoá mã hoá 64 ký tự hex', () => {
    expect(() => parseEnv({ ...valid, APP_ENCRYPTION_KEY: undefined })).toThrow(/APP_ENCRYPTION_KEY/);
    expect(() => parseEnv({ ...valid, APP_ENCRYPTION_KEY: 'ngan-qua' })).toThrow(/64 ký tự hex/);
  });

  it('báo rõ tên biến bị thiếu', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('từ chối DATABASE_URL không phải postgres', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('mặc định APP_URL là localhost khi dev', () => {
    const env = parseEnv({ NODE_ENV: 'development', DATABASE_URL: valid.DATABASE_URL });
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.ROOT_DOMAIN).toBe('localhost');
  });

  it('production bắt buộc cấu hình SMTP', () => {
    expect(() => parseEnv({ ...valid, SMTP_PASS: undefined })).toThrow(/SMTP_PASS/);
    expect(parseEnv(valid).MAIL_DRIVER).toBe('smtp');
  });

  it('dev in mail ra console, test dùng hộp thư giả', () => {
    expect(parseEnv({ NODE_ENV: 'development', DATABASE_URL: valid.DATABASE_URL }).MAIL_DRIVER).toBe(
      'console',
    );
    expect(parseEnv({ NODE_ENV: 'test', DATABASE_URL: valid.DATABASE_URL }).MAIL_DRIVER).toBe('memory');
  });

  it('production chặn driver mail của test, trừ khi chạy E2E', () => {
    expect(() => parseEnv({ ...valid, MAIL_DRIVER: 'file' })).toThrow(/MAIL_DRIVER/);
    expect(() => parseEnv({ ...valid, MAIL_DRIVER: 'memory' })).toThrow(/MAIL_DRIVER/);
    expect(parseEnv({ ...valid, MAIL_DRIVER: 'file', TEST_MODE: 'e2e' }).MAIL_DRIVER).toBe('file');
  });

  it('production: PayOS thật bắt buộc đủ khoá; driver fake bị chặn trừ khi chạy E2E', () => {
    expect(parseEnv(valid).PAYMENTS_DRIVER).toBe('payos');
    expect(() => parseEnv({ ...valid, PAYOS_CHECKSUM_KEY: undefined })).toThrow(/PAYOS_CHECKSUM_KEY/);
    expect(() => parseEnv({ ...valid, PAYMENTS_DRIVER: 'fake' })).toThrow(/PAYMENTS_DRIVER/);
    expect(parseEnv({ ...valid, PAYMENTS_DRIVER: 'fake', TEST_MODE: 'e2e' }).PAYMENTS_DRIVER).toBe('fake');
  });

  it('production bắt buộc INTERNAL_CRON_TOKEN đủ dài', () => {
    expect(() => parseEnv({ ...valid, INTERNAL_CRON_TOKEN: 'ngan' })).toThrow(/INTERNAL_CRON_TOKEN/);
  });

  it('dev mặc định dùng PayOS giả với checksum key riêng', () => {
    const dev = parseEnv({ NODE_ENV: 'development', DATABASE_URL: valid.DATABASE_URL });
    expect(dev.PAYMENTS_DRIVER).toBe('fake');
    expect(dev.PAYOS_CHECKSUM_KEY).toBe('fake-checksum-key-9mua');
  });

  it('bắt buộc APP_URL ở production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', DATABASE_URL: valid.DATABASE_URL })).toThrow(/APP_URL/);
  });
});
