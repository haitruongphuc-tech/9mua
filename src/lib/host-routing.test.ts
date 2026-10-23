import { describe, expect, it } from 'vitest';
import { routeRequest } from './host-routing';

const prod = 'https://9mua.com';
const e2e = 'http://9mua.test:3100';

describe('routeRequest', () => {
  it('tên miền chính đi bình thường', () => {
    expect(routeRequest({ host: '9mua.com', pathname: '/cho', search: '' }, prod)).toEqual({ type: 'next' });
  });

  it('www chuyển về tên miền chính', () => {
    expect(routeRequest({ host: 'www.9mua.com', pathname: '/cho', search: '?q=a' }, prod)).toEqual({
      type: 'redirect',
      url: 'https://9mua.com/cho?q=a',
    });
  });

  it('trang chủ và trang sản phẩm của Kiot được rewrite sang /k/<slug>', () => {
    expect(routeRequest({ host: 'thanh-long.9mua.com', pathname: '/', search: '' }, prod)).toEqual({
      type: 'rewrite',
      pathname: '/k/thanh-long',
    });
    expect(
      routeRequest({ host: 'thanh-long.9mua.com', pathname: '/p/abc-thanh-long', search: '' }, prod),
    ).toEqual({
      type: 'rewrite',
      pathname: '/k/thanh-long/p/abc-thanh-long',
    });
    expect(routeRequest({ host: 'abc.9mua.test:3100', pathname: '/', search: '' }, e2e)).toEqual({
      type: 'rewrite',
      pathname: '/k/abc',
    });
  });

  it('API, ảnh, file tĩnh trên tên miền Kiot đi thẳng (không rewrite)', () => {
    for (const pathname of [
      '/api/auth/me',
      '/_next/static/x.js',
      '/uploads/a.webp',
      '/brand/9mua-icon.png',
      '/favicon.ico',
    ]) {
      expect(routeRequest({ host: 'abc.9mua.com', pathname, search: '' }, prod)).toEqual({ type: 'next' });
    }
  });

  it('đường dẫn khác trên tên miền Kiot chuyển về 9mua.com (đăng nhập, giỏ hàng…)', () => {
    expect(routeRequest({ host: 'abc.9mua.com', pathname: '/dang-nhap', search: '?next=%2F' }, prod)).toEqual(
      {
        type: 'redirect',
        url: 'https://9mua.com/dang-nhap?next=%2F',
      },
    );
  });

  it('tên miền phụ nhiều cấp hoặc không hợp lệ không được coi là Kiot', () => {
    expect(routeRequest({ host: 'a.b.9mua.com', pathname: '/', search: '' }, prod)).toEqual({
      type: 'not-found',
    });
    expect(routeRequest({ host: 'evil.com', pathname: '/', search: '' }, prod)).toEqual({ type: 'next' });
  });

  it('không cho gõ thẳng /k/… trên tên miền Kiot để đọc Kiot khác', () => {
    expect(routeRequest({ host: 'abc.9mua.com', pathname: '/k/xyz', search: '' }, prod)).toEqual({
      type: 'redirect',
      url: 'https://9mua.com/k/xyz',
    });
  });
});
