import { describe, expect, it } from 'vitest';
import { vi } from '@/i18n/messages/vi';
import { sloganKey } from './slogans';

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
    expect(vi['common.slogan.home']).toBe('Mở cổng thế giới - Một chạm là tới');
    expect(vi['common.slogan.explore']).toBe('Kiot nào cũng là showroom - 9MUA kết nối');
  });
});
