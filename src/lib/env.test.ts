import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  APP_URL: 'https://9mua.com',
};

describe('parseEnv', () => {
  it('chấp nhận cấu hình hợp lệ', () => {
    const env = parseEnv(valid);
    expect(env.APP_URL).toBe('https://9mua.com');
    expect(env.ROOT_DOMAIN).toBe('9mua.com');
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

  it('bắt buộc APP_URL ở production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', DATABASE_URL: valid.DATABASE_URL })).toThrow(/APP_URL/);
  });
});
