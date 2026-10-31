import { db } from '@/lib/db';

// Giao diện Kiot kéo thả (SPEC-kiot.md V5.3, công tắc kiot_builder): 50 mẫu = 10 bố cục × 5 bảng màu; các khối bật/tắt và
// đổi thứ tự. Lưu vào Kiot.layout (JSON, kiểm cấu trúc ở máy chủ). Kiot chưa từng chỉnh (layout null) giữ giao diện cũ.
export const KIOT_TEMPLATES = [
  { id: 'l1', cover: '3/1', align: 'left', featuredCols: 4 },
  { id: 'l2', cover: '3/1', align: 'center', featuredCols: 4 },
  { id: 'l3', cover: '2/1', align: 'left', featuredCols: 3 },
  { id: 'l4', cover: '2/1', align: 'center', featuredCols: 3 },
  { id: 'l5', cover: '4/1', align: 'left', featuredCols: 4 },
  { id: 'l6', cover: '4/1', align: 'center', featuredCols: 2 },
  { id: 'l7', cover: '16/9', align: 'left', featuredCols: 2 },
  { id: 'l8', cover: '16/9', align: 'center', featuredCols: 4 },
  { id: 'l9', cover: '5/2', align: 'left', featuredCols: 2 },
  { id: 'l10', cover: '5/2', align: 'center', featuredCols: 3 },
] as const;

// Bảng màu trên nền tối: chữ trên nút đạt độ tương phản ≥ 4,5:1 (docs/BRAND.md).
export const KIOT_PALETTES = [
  { id: 'p1', accent: '#ff6b00', onAccent: '#ffffff', surface: '#1a1410' }, // cam 9MUA
  { id: 'p2', accent: '#16a34a', onAccent: '#ffffff', surface: '#0f1a13' }, // xanh lá
  { id: 'p3', accent: '#2563eb', onAccent: '#ffffff', surface: '#0f1422' }, // xanh dương
  { id: 'p4', accent: '#db2777', onAccent: '#ffffff', surface: '#1f0f17' }, // hồng
  { id: 'p5', accent: '#facc15', onAccent: '#1a1a1a', surface: '#1c1a0e' }, // vàng
] as const;

export type KiotTemplate = (typeof KIOT_TEMPLATES)[number];
export type KiotPalette = (typeof KIOT_PALETTES)[number];

export const KIOT_BLOCKS = [
  'cover',
  'about',
  'featured',
  'products',
  'video',
  'live',
  'reviews',
  'events',
  'contact',
  'map',
  'social',
] as const;
export type KiotBlock = (typeof KIOT_BLOCKS)[number];
export const MAX_FEATURED = 8;

export type KiotLayout = {
  template: (typeof KIOT_TEMPLATES)[number]['id'];
  palette: (typeof KIOT_PALETTES)[number]['id'];
  blocks: { id: KiotBlock; on: boolean }[];
  featured: string[]; // productId, tối đa 8
};

export const DEFAULT_LAYOUT: KiotLayout = {
  template: 'l1',
  palette: 'p1',
  blocks: KIOT_BLOCKS.map((id) => ({ id, on: id !== 'featured' && id !== 'map' })),
  featured: [],
};

// Kiểm cấu trúc: mẫu / bảng màu có thật, đủ 11 khối không trùng, tối đa 8 sản phẩm nổi bật.
export function parseLayout(raw: unknown): KiotLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (!KIOT_TEMPLATES.some((t) => t.id === v.template)) return null;
  if (!KIOT_PALETTES.some((p) => p.id === v.palette)) return null;
  if (!Array.isArray(v.blocks) || v.blocks.length !== KIOT_BLOCKS.length) return null;
  const blocks: KiotLayout['blocks'] = [];
  for (const b of v.blocks) {
    const id = (b as { id?: unknown })?.id;
    const on = (b as { on?: unknown })?.on;
    if (!KIOT_BLOCKS.includes(id as KiotBlock) || typeof on !== 'boolean' || blocks.some((x) => x.id === id))
      return null;
    blocks.push({ id: id as KiotBlock, on });
  }
  const featured = Array.isArray(v.featured)
    ? v.featured.filter((x): x is string => typeof x === 'string')
    : [];
  if (featured.length > MAX_FEATURED || new Set(featured).size !== featured.length) return null;
  return {
    template: v.template as KiotLayout['template'],
    palette: v.palette as KiotLayout['palette'],
    blocks,
    featured,
  };
}

export async function setKiotLayout(
  ownerId: string,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: 'NO_KIOT' | 'INVALID' }> {
  const kiot = await db.kiot.findUnique({ where: { ownerId }, select: { id: true } });
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  const layout = parseLayout(raw);
  if (!layout) return { ok: false, error: 'INVALID' };
  // Sản phẩm nổi bật phải là sản phẩm của chính Kiot này.
  const own = await db.product.count({
    where: { id: { in: layout.featured }, kiotId: kiot.id, deletedAt: null },
  });
  if (own !== layout.featured.length) return { ok: false, error: 'INVALID' };
  await db.kiot.update({ where: { id: kiot.id }, data: { layout } });
  return { ok: true };
}

// Giao diện đang dùng; null = Kiot chưa từng chỉnh (giữ trang cũ). Dữ liệu hỏng cũng coi như chưa chỉnh.
export function kiotLayoutOf(kiot: { layout: unknown }): KiotLayout | null {
  return kiot.layout ? parseLayout(kiot.layout) : null;
}

export const templateOf = (l: KiotLayout) =>
  KIOT_TEMPLATES.find((t) => t.id === l.template) ?? KIOT_TEMPLATES[0];
export const paletteOf = (l: KiotLayout) => KIOT_PALETTES.find((p) => p.id === l.palette) ?? KIOT_PALETTES[0];

// Bảo hành mặc định cho sản phẩm mới (SPEC-kiot.md V5.5), ≤ 60 ký tự.
export async function setWarrantyDefault(ownerId: string, text: string): Promise<boolean> {
  const value = text.trim().slice(0, 60);
  const r = await db.kiot.updateMany({ where: { ownerId }, data: { warrantyDefault: value || null } });
  return r.count > 0;
}

// Bảo hành của một sản phẩm (chủ Kiot sửa ở trang sửa sản phẩm).
export async function setProductWarranty(ownerId: string, productId: string, text: string): Promise<boolean> {
  const value = text.trim().slice(0, 60);
  const r = await db.product.updateMany({
    where: { id: productId, deletedAt: null, kiot: { ownerId } },
    data: { warranty: value || null },
  });
  return r.count > 0;
}
