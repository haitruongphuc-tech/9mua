import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it('giữ đường dẫn nội bộ', () => {
    expect(safeNextPath('/kiot-cua-toi/tao?x=1')).toBe('/kiot-cua-toi/tao?x=1');
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    'abc',
  ])('chặn chuyển hướng ra ngoài: %s', (value) => {
    expect(safeNextPath(value)).toBe('/');
  });
});
