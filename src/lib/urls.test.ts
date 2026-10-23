import { describe, expect, it } from 'vitest';
import { kiotOrigin } from './urls';

describe('kiotOrigin', () => {
  it('production', () => {
    expect(kiotOrigin('thanh-long', 'https://9mua.com')).toBe('https://thanh-long.9mua.com');
  });
  it('giữ cổng khi chạy thử', () => {
    expect(kiotOrigin('abc', 'http://9mua.test:3100')).toBe('http://abc.9mua.test:3100');
  });
});
