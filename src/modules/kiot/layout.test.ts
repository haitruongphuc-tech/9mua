import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createProduct, createSeller } from '../../../tests/helpers/factories';
import {
  DEFAULT_LAYOUT,
  KIOT_PALETTES,
  KIOT_TEMPLATES,
  kiotLayoutOf,
  parseLayout,
  setKiotLayout,
  setProductWarranty,
  setWarrantyDefault,
} from './layout';
import { featuredProducts } from './public';
import { createProduct as createViaModule } from './product';

describe('giao diện Kiot + bảo hành (SPEC-kiot.md V5.3, V5.5)', () => {
  it('50 mẫu = 10 bố cục × 5 bảng màu; kiểm cấu trúc ở máy chủ', () => {
    expect(KIOT_TEMPLATES.length * KIOT_PALETTES.length).toBe(50);
    expect(parseLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout({ ...DEFAULT_LAYOUT, template: 'l99' })).toBeNull();
    expect(parseLayout({ ...DEFAULT_LAYOUT, blocks: DEFAULT_LAYOUT.blocks.slice(1) })).toBeNull();
    expect(
      parseLayout({
        ...DEFAULT_LAYOUT,
        blocks: [...DEFAULT_LAYOUT.blocks.slice(1), DEFAULT_LAYOUT.blocks[1]],
      }),
    ).toBeNull();
    expect(
      parseLayout({ ...DEFAULT_LAYOUT, featured: Array.from({ length: 9 }, (_, i) => `p${i}`) }),
    ).toBeNull();
  });

  it('lưu giao diện: sản phẩm nổi bật phải của chính Kiot; Kiot chưa chỉnh thì layout null', async () => {
    const a = await createSeller({ active: true });
    const b = await createSeller({ active: true });
    const mine = await createProduct(a.kiotId, { name: 'Nổi bật' });
    const other = await createProduct(b.kiotId);
    expect(kiotLayoutOf(await db.kiot.findUniqueOrThrow({ where: { id: a.kiotId } }))).toBeNull();
    expect(await setKiotLayout(a.user.id, { ...DEFAULT_LAYOUT, featured: [other.id] })).toEqual({
      ok: false,
      error: 'INVALID',
    });
    const blocks = [...DEFAULT_LAYOUT.blocks].reverse().map((x) => ({ ...x, on: true }));
    expect(
      await setKiotLayout(a.user.id, { template: 'l7', palette: 'p3', blocks, featured: [mine.id] }),
    ).toEqual({ ok: true });
    const saved = kiotLayoutOf(await db.kiot.findUniqueOrThrow({ where: { id: a.kiotId } }));
    expect(saved?.blocks[0]?.id).toBe('social');
    expect((await featuredProducts(a.kiotId, [mine.id, other.id])).map((p) => p.id)).toEqual([mine.id]);
  });

  it('bảo hành mặc định điền sẵn cho sản phẩm mới; sửa từng sản phẩm, ≤ 60 ký tự', async () => {
    const s = await createSeller({ active: true });
    expect(await setWarrantyDefault(s.user.id, 'Bảo hành 12 tháng tại Kiot')).toBe(true);
    const img = await db.productImage.create({
      data: { kiotId: s.kiotId, url: '/uploads/x.webp', thumbUrl: '/uploads/x-t.webp', width: 1, height: 1 },
    });
    const r = await createViaModule(s.user.id, {
      name: 'Máy xay',
      description: '',
      price: 500_000,
      stock: 3,
      category: 'khac',
      imageIds: [img.id],
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const p = await db.product.findFirstOrThrow({ where: { kiotId: s.kiotId } });
    expect(p.warranty).toBe('Bảo hành 12 tháng tại Kiot');
    expect(await setProductWarranty(s.user.id, p.id, 'x'.repeat(80))).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).warranty).toHaveLength(60);
  });
});
