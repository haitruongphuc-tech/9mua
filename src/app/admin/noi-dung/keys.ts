import type { SloganKey } from '@/lib/slogans';

export const SLOGAN_KEYS: SloganKey[] = ['home', 'explore', 'live', 'cart', 'profile', 'ai', 'legal'];
export const SLOGAN_PAGES: Record<SloganKey, string> = {
  home: 'Trang chủ / Video',
  explore: 'Chợ',
  live: 'Live',
  cart: 'Giỏ hàng, đơn hàng',
  profile: 'Trang Kiot',
  ai: 'AI Studio',
  legal: 'Giới thiệu & pháp lý',
};
