// Slogan của từng trang, lấy nguyên từ V4 (docs/v4-merge-plan.md, T45). CEO sửa được ở /admin trong giai đoạn C.
export const SLOGANS = {
  home: 'Mở cổng thế giới - Một chạm là tới',
  explore: 'Kiot nào cũng là showroom - 9MUA kết nối',
  live: 'Nhìn thật - Mua thật - Người thật việc thật',
  cart: 'Gom cả chợ vào một túi - Túi cam 9MUA',
  profile: 'Mỗi Kiot là một thương hiệu - CEO đứng sau',
  legal: '99% AI vận hành - 1% CEO phê duyệt - Người thật',
} as const;

export type SloganKey = keyof typeof SLOGANS;

const starts = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function sloganKey(pathname: string, opts: { onKiotHost?: boolean } = {}): SloganKey {
  if (opts.onKiotHost || starts(pathname, '/k')) return 'profile';
  if (starts(pathname, '/cho')) return 'explore';
  if (starts(pathname, '/live')) return 'live';
  if (['/gio-hang', '/dat-hang', '/don-mua'].some((p) => starts(pathname, p))) return 'cart';
  return 'home';
}
