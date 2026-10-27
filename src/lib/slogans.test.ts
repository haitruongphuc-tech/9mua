import { describe, expect, it } from 'vitest';
import { SLOGANS, sloganKey } from './slogans';

describe('sloganKey: slogan của trang theo đường dẫn (V4)', () => {
  it.each([
    ['/', 'home'],
    ['/video', 'home'],
    ['/cho', 'explore'],
    ['/cho/nong-san', 'explore'],
    ['/cho/kiot', 'explore'],
    ['/live', 'live'],
    ['/live/phat', 'live'],
    ['/gio-hang', 'cart'],
    ['/dat-hang/abc', 'cart'],
    ['/don-mua', 'cart'],
    ['/k/mat-ong', 'profile'],
    ['/tai-khoan', 'home'],
  ] as const)('%s → %s', (path, key) => {
    expect(sloganKey(path)).toBe(key);
  });

  it('trang Kiot trên tên miền con luôn dùng slogan Kiot', () => {
    expect(sloganKey('/', { onKiotHost: true })).toBe('profile');
  });

  it('câu slogan đúng bản V4', () => {
    expect(SLOGANS.home).toBe('Mở cổng thế giới - Một chạm là tới');
    expect(SLOGANS.explore).toBe('Kiot nào cũng là showroom - 9MUA kết nối');
  });
});
