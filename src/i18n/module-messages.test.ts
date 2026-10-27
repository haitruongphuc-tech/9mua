import { describe, expect, it } from 'vitest';
import { localizeFields, localizeModuleMessage } from './module-messages';
import { en } from './messages/en';
import { translate } from './translate';
import { vi } from './messages/vi';

const tEn = (key: keyof typeof vi, vars?: Record<string, string | number>) => translate(en, vi, key, vars);

describe('dịch lỗi kiểm tra dữ liệu của module', () => {
  it('câu đã biết ra tiếng đang chọn; câu lạ giữ nguyên; số ảnh tối đa giữ đúng số', () => {
    expect(localizeModuleMessage(tEn, 'Tên Kiot cần ít nhất 2 ký tự')).toBe(en['seller.v.kiotNameMin']);
    expect(localizeModuleMessage(tEn, 'Tối đa 9 ảnh')).toBe(en['seller.v.imageMax'].replace('{max}', '9'));
    expect(localizeModuleMessage(tEn, 'Câu lạ chưa dịch')).toBe('Câu lạ chưa dịch');
    expect(localizeFields(tEn, { name: 'Nhập giá bán', other: undefined })).toEqual({
      name: en['seller.v.priceRequired'],
    });
  });

  it('mọi câu trong bảng đều khớp đúng câu gốc của module (đổi câu ở module thì test này báo)', async () => {
    const sources = await Promise.all(
      [
        '../modules/kiot/kiot.ts',
        '../modules/kiot/product.ts',
        '../modules/kiot/profile.ts',
        '../modules/kiot/payout-account.ts',
      ].map(async (p) => (await import('node:fs/promises')).readFile(new URL(p, import.meta.url), 'utf8')),
    );
    const all = sources.join('\n');
    for (const key of Object.keys(vi).filter((k) => k.startsWith('seller.v.') && k !== 'seller.v.imageMax'))
      expect(all, key).toContain(vi[key as keyof typeof vi]);
  });
});
