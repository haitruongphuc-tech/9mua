import { z } from 'zod';
import { CATEGORIES, PROVINCES } from '@/modules/kiot';

// Chuẩn hoá từ khoá giống hàm search_norm trong DB: bỏ dấu (đ → d), chữ thường, chỉ giữ chữ và số.
export function normalizeQuery(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

export const SORTS = [
  { value: 'phu-hop', label: 'Phù hợp' },
  { value: 'ban-chay', label: 'Bán chạy' },
  { value: 'moi-nhat', label: 'Mới nhất' },
  { value: 'gia-tang', label: 'Giá tăng dần' },
  { value: 'gia-giam', label: 'Giá giảm dần' },
] as const;
export type Sort = (typeof SORTS)[number]['value'];

export type SearchParams = {
  q?: string;
  category?: string;
  province?: string;
  priceMin?: number;
  priceMax?: number;
  sort: Sort;
  cursor?: string;
};

const CATEGORY_SET = new Set<string>(CATEGORIES.map((c) => c.slug));
const PROVINCE_SET = new Set<string>(PROVINCES.map((p) => p.slug));
const price = z.coerce.number().int().min(0).max(1_000_000_000).optional().catch(undefined);

// Bộ lọc nằm trên URL (/cho?q=thanh+long&dm=nong-san&sx=ban-chay) để chia sẻ link vẫn đúng kết quả.
// Giá trị lạ bị bỏ qua thay vì báo lỗi.
export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchParams {
  const get = (k: string) => {
    const v = raw[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const q = get('q')?.slice(0, 100);
  const category = get('dm');
  const province = get('tinh');
  const sort = SORTS.find((s) => s.value === get('sx'))?.value ?? (q ? 'phu-hop' : 'moi-nhat');
  return {
    q,
    category: category && CATEGORY_SET.has(category) ? category : undefined,
    province: province && PROVINCE_SET.has(province) ? province : undefined,
    priceMin: price.parse(get('giatu')),
    priceMax: price.parse(get('giaden')),
    sort: sort === 'phu-hop' && !q ? 'moi-nhat' : sort,
    cursor: get('sau'),
  };
}

export function toSearchString(p: Partial<SearchParams>): string {
  const out = new URLSearchParams();
  if (p.q) out.set('q', p.q);
  if (p.category) out.set('dm', p.category);
  if (p.province) out.set('tinh', p.province);
  if (p.priceMin !== undefined) out.set('giatu', String(p.priceMin));
  if (p.priceMax !== undefined) out.set('giaden', String(p.priceMax));
  if (p.sort && p.sort !== (p.q ? 'phu-hop' : 'moi-nhat')) out.set('sx', p.sort);
  if (p.cursor) out.set('sau', p.cursor);
  return out.toString();
}
