import { describe, expect, it } from 'vitest';
import { normalizeIdentifier } from './identifier';

describe('normalizeIdentifier', () => {
  it.each([
    ['0979393916', '+84979393916'],
    ['0979 393 916', '+84979393916'],
    ['097.939.3916', '+84979393916'],
    ['+84979393916', '+84979393916'],
    ['84979393916', '+84979393916'],
    ['0359-123-456', '+84359123456'],
  ])('chuẩn hoá SĐT %s → %s', (input, phone) => {
    expect(normalizeIdentifier(input)).toMatchObject({ kind: 'phone', value: phone });
  });

  it.each(['0123456789', '097939391', '09793939160', '+1 650 555 0100', 'abc'])(
    'từ chối SĐT sai %s',
    (input) => {
      expect(normalizeIdentifier(input)).toBeNull();
    },
  );

  it('chuẩn hoá email về chữ thường', () => {
    expect(normalizeIdentifier('  CeoTruongPhucHai@Gmail.COM ')).toMatchObject({
      kind: 'email',
      value: 'ceotruongphuchai@gmail.com',
    });
  });

  it('từ chối email sai', () => {
    expect(normalizeIdentifier('a@')).toBeNull();
    expect(normalizeIdentifier('a b@x.com')).toBeNull();
  });
});
