import { afterEach, describe, expect, it } from 'vitest';
import { isInternalRequest } from './internal-route';

const token = 'a'.repeat(40);
afterEach(() => {
  delete process.env.INTERNAL_CRON_TOKEN;
});

const req = (header?: string) =>
  new Request('http://127.0.0.1:3009/api/internal/x', {
    headers: header ? { 'x-internal-token': header } : {},
  });

describe('isInternalRequest', () => {
  it('đúng token thì cho qua', () => {
    process.env.INTERNAL_CRON_TOKEN = token;
    expect(isInternalRequest(req(token))).toBe(true);
  });

  it('thiếu hoặc sai token (kể cả sai độ dài) thì chặn', () => {
    process.env.INTERNAL_CRON_TOKEN = token;
    expect(isInternalRequest(req())).toBe(false);
    expect(isInternalRequest(req('b'.repeat(40)))).toBe(false);
    expect(isInternalRequest(req('a'))).toBe(false);
  });

  it('chưa cấu hình token thì luôn chặn', () => {
    expect(isInternalRequest(req(''))).toBe(false);
    expect(isInternalRequest(req('anything'))).toBe(false);
  });
});
