import { describe, expect, it } from 'vitest';
import { slugify, validateSlug } from './slug';

describe('slugify', () => {
  it.each([
    ['Thanh Long Bình Thuận', 'thanh-long-binh-thuan'],
    ['Đặc sản Đà Lạt', 'dac-san-da-lat'],
    ['  Muối ớt   Tây Ninh!!! ', 'muoi-ot-tay-ninh'],
    ['Giỏ tre & Mây_tre', 'gio-tre-may-tre'],
    ['ỨNG DỤNG 9MUA', 'ung-dung-9mua'],
    ['Cà phê Buôn Ma Thuột nguyên chất loại một đặc biệt', 'ca-phe-buon-ma-thuot-nguyen'],
  ])('%s → %s', (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });

  it('không bao giờ kết thúc bằng dấu gạch khi cắt', () => {
    expect(slugify('aaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbb')).not.toMatch(/-$/);
  });
});

describe('validateSlug', () => {
  it.each(['abc', 'thanh-long-binh-thuan', '9mua-shop', 'a1b'])('hợp lệ: %s', (slug) => {
    expect(validateSlug(slug)).toEqual({ ok: true });
  });

  it.each([
    ['ab', 'SLUG_INVALID'],
    ['a'.repeat(31), 'SLUG_INVALID'],
    ['-abc', 'SLUG_INVALID'],
    ['abc-', 'SLUG_INVALID'],
    ['ab--c', 'SLUG_INVALID'],
    ['Abc', 'SLUG_INVALID'],
    ['ab_c', 'SLUG_INVALID'],
    ['admin', 'SLUG_RESERVED'],
    ['www', 'SLUG_RESERVED'],
    ['cho', 'SLUG_RESERVED'],
    ['dang-nhap', 'SLUG_RESERVED'],
    ['9mua', 'SLUG_RESERVED'],
  ])('từ chối %s (%s)', (slug, error) => {
    expect(validateSlug(slug)).toEqual({ ok: false, error });
  });
});
