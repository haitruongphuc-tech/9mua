import { describe, expect, it } from 'vitest';
import { normalizeSocialUrl } from './connect';

describe('normalizeSocialUrl', () => {
  it.each([
    ['tiktok', 'tiktok.com/@9mua', 'https://tiktok.com/@9mua'],
    ['tiktok', 'https://www.tiktok.com/@9mua#x', 'https://www.tiktok.com/@9mua'],
    ['facebook', 'http://m.facebook.com/9mua', 'https://m.facebook.com/9mua'],
    ['youtube', 'https://youtu.be/abc', 'https://youtu.be/abc'],
    ['zalo', 'zalo.me/0979393916', 'https://zalo.me/0979393916'],
  ] as const)('%s %s → %s', (p, raw, out) => expect(normalizeSocialUrl(p, raw)).toBe(out));

  it.each([
    ['tiktok', 'https://evil.com/tiktok.com'],
    ['facebook', 'https://facebook.com.evil.vn/x'],
    ['shopee', 'javascript:alert(1)'],
    ['instagram', 'không phải link'],
  ] as const)('%s chặn %s', (p, raw) => expect(normalizeSocialUrl(p, raw)).toBeNull());
});
