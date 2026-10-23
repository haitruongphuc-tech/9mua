import { RESERVED_SLUGS } from './reserved-slugs';

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "Thanh Long Bình Thuận" → "thanh-long-binh-thuan"; cắt ở ranh giới từ nếu dài hơn 30 ký tự.
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= SLUG_MAX) return base;
  const cut = base.slice(0, SLUG_MAX + 1);
  const boundary = cut.lastIndexOf('-');
  return (boundary >= SLUG_MIN ? cut.slice(0, boundary) : base.slice(0, SLUG_MAX)).replace(/-+$/, '');
}

export type SlugCheck = { ok: true } | { ok: false; error: 'SLUG_INVALID' | 'SLUG_RESERVED' };

export function validateSlug(slug: string): SlugCheck {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'SLUG_INVALID' };
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'SLUG_RESERVED' };
  return { ok: true };
}
