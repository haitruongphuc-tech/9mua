// Slogan của từng trang theo V4 (T45). Chữ nằm trong từ điển i18n, khoá `common.slogan.<key>`; CEO sửa được ở
// /admin trong giai đoạn C.
export type SloganKey = 'home' | 'explore' | 'live' | 'cart' | 'profile' | 'legal';

const starts = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function sloganKey(pathname: string, opts: { onKiotHost?: boolean } = {}): SloganKey {
  if (opts.onKiotHost || starts(pathname, '/k')) return 'profile';
  if (starts(pathname, '/cho')) return 'explore';
  if (starts(pathname, '/live')) return 'live';
  if (['/gio-hang', '/dat-hang', '/don-mua'].some((p) => starts(pathname, p))) return 'cart';
  return 'home';
}
