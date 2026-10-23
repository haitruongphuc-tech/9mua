import { describe, expect, it } from 'vitest';
import { normalizeQuery, parseSearchParams, toSearchString } from './query';

describe('chuẩn hoá từ khoá', () => {
  it('bỏ dấu, đ → d, chữ thường, gộp khoảng trắng, bỏ ký tự lạ', () => {
    expect(normalizeQuery('  Thanh   LÒNG ')).toBe('thanh long');
    expect(normalizeQuery('Đặc sản Đà Lạt!')).toBe('dac san da lat');
    expect(normalizeQuery("áo%_thun'; DROP")).toBe('ao thun drop');
  });
});

describe('bộ lọc trên URL', () => {
  it('đọc rồi ghi lại giữ nguyên', () => {
    const p = parseSearchParams({
      q: 'thanh long',
      dm: 'nong-san',
      sx: 'ban-chay',
      tinh: 'lam-dong',
      giatu: '10000',
    });
    expect(p).toEqual({
      q: 'thanh long',
      category: 'nong-san',
      province: 'lam-dong',
      priceMin: 10_000,
      priceMax: undefined,
      sort: 'ban-chay',
      cursor: undefined,
    });
    expect(toSearchString(p)).toBe('q=thanh+long&dm=nong-san&tinh=lam-dong&giatu=10000&sx=ban-chay');
  });

  it('mặc định: có từ khoá thì Phù hợp, không có thì Mới nhất; giá trị lạ bị bỏ qua', () => {
    expect(parseSearchParams({ q: 'cam' }).sort).toBe('phu-hop');
    expect(parseSearchParams({}).sort).toBe('moi-nhat');
    expect(parseSearchParams({ sx: 'phu-hop' }).sort).toBe('moi-nhat');
    expect(
      parseSearchParams({ dm: 'vu-khi', tinh: 'sao-hoa', giatu: '-5', giaden: 'abc', sx: 'x' }),
    ).toMatchObject({
      category: undefined,
      province: undefined,
      priceMin: undefined,
      priceMax: undefined,
      sort: 'moi-nhat',
    });
    expect(toSearchString(parseSearchParams({ q: 'cam' }))).toBe('q=cam');
  });
});
