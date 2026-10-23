import { describe, expect, it } from 'vitest';
import { buildVietQr, crc16, parseTlv } from './vietqr';

describe('VietQR (EMVCo)', () => {
  it('CRC16-CCITT đúng chuẩn (giá trị kiểm tra 123456789 → 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('chuỗi QR chứa đúng BIN, STK, số tiền, nội dung và CRC hợp lệ', () => {
    const qr = buildVietQr({
      bin: '970422',
      accountNumber: '0979393916',
      amount: 48_000,
      description: '9MUA RUT RT100001',
    });
    const top = parseTlv(qr);
    expect(top['00']).toBe('01');
    expect(top['01']).toBe('12');
    expect(top['53']).toBe('704');
    expect(top['54']).toBe('48000');
    expect(top['58']).toBe('VN');
    const merchant = parseTlv(top['38']!);
    expect(merchant['00']).toBe('A000000727');
    expect(merchant['02']).toBe('QRIBFTTA');
    expect(parseTlv(merchant['01']!)).toEqual({ '00': '970422', '01': '0979393916' });
    expect(parseTlv(top['62']!)['08']).toBe('9MUA RUT RT100001');
    expect(qr.slice(-4)).toBe(crc16(qr.slice(0, -4)));
  });

  it('bỏ dấu tiếng Việt trong nội dung', () => {
    const qr = buildVietQr({
      bin: '970436',
      accountNumber: '123',
      amount: 1000,
      description: 'Hoàn tiền đơn',
    });
    expect(parseTlv(parseTlv(qr)['62']!)['08']).toBe('Hoan tien don');
  });
});
