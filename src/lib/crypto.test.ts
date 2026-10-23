import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto';

describe('mã hoá bí mật', () => {
  it('mã hoá rồi giải mã đúng; mỗi lần mã hoá ra chuỗi khác; sửa 1 ký tự thì giải mã lỗi', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    const b = encryptSecret('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(a).not.toContain('JBSWY3DP');
    expect(decryptSecret(a)).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    const tampered = a.slice(0, -2) + (a.endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
