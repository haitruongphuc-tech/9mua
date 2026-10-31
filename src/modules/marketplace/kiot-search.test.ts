import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { distanceKm, PROVINCE_CENTERS, setKiotLocation } from '@/modules/kiot';
import { createProduct, createSeller } from '../../../tests/helpers/factories';
import { searchKiots } from './kiot-search';
import { searchProducts } from './search';

async function kiot(name: string, province: string, prices: number[]) {
  const s = await createSeller({ active: true });
  await db.kiot.update({
    where: { id: s.kiotId },
    data: { name, province, addressLine: 'Chợ Bến Thành, phường Bến Thành' },
  });
  for (const price of prices) await createProduct(s.kiotId, { price, stock: 5 });
  return s;
}

describe('tìm Kiot và Gần tôi (SPEC-marketplace.md V5.1–V5.2)', () => {
  it('haversine: Hà Nội – TP.HCM khoảng 1.140 km', () => {
    const d = distanceKm(PROVINCE_CENTERS['ha-noi'], PROVINCE_CENTERS['tp-ho-chi-minh']);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1200);
  });

  it('tìm theo tên không dấu, khoảng giá, lọc khu vực; Gần tôi xếp gần nhất, Kiot chưa ghim là "khoảng"', async () => {
    const tag = String(Date.now()).slice(-5);
    const a = await kiot(`Hải sản Cô Ba ${tag}`, 'tp-ho-chi-minh', [50_000, 250_000]);
    const b = await kiot(`Hải sản Miền Tây ${tag}`, 'can-tho', [80_000]);
    // A đặt ghim ở trung tâm TP.HCM; B chưa ghim → tâm tỉnh Cần Thơ (~140 km).
    expect(
      await setKiotLocation(a.user.id, { pin: { lat: 10.7725, lng: 106.698 }, showExact: false }),
    ).toEqual({ ok: true });
    expect(await setKiotLocation(a.user.id, { pin: { lat: 99, lng: 0 }, showExact: false })).toEqual({
      ok: false,
      error: 'INVALID',
    });

    const byName = await searchKiots({ q: `hai san co ba ${tag}` });
    // Gõ gần đúng có thể ra cả Kiot tên na ná; Kiot khớp nguyên cụm đứng đầu.
    expect(byName.items[0]?.slug).toBe(a.slug);
    expect(byName.items[0]).toMatchObject({ priceMin: 50_000, priceMax: 250_000, products: 2 });
    expect((await searchKiots({ q: tag, area: 'ben thanh' })).items).toHaveLength(2);
    expect((await searchKiots({ q: tag, area: 'phuong khac' })).items).toHaveLength(0);

    const here = { lat: 10.776, lng: 106.701 };
    const near = await searchKiots({ q: tag, near: { ...here, radiusKm: 5 } });
    expect(near.items.map((k) => k.slug)).toEqual([a.slug]);
    expect(near.items[0]?.approx).toBe(false);
    expect(near.items[0]!.distanceKm!).toBeLessThan(1);
    const wide = await searchKiots({ q: tag, near: { ...here, radiusKm: 200 } });
    expect(wide.items.map((k) => k.slug)).toEqual([a.slug, b.slug]);
    expect(wide.items[1]?.approx).toBe(true);

    // Sản phẩm: tham số near lọc bán kính, không truyền thì như cũ.
    const products = await searchProducts({ q: '', sort: 'moi-nhat', province: 'can-tho' }, 50, {
      ...here,
      radiusKm: 5,
    });
    expect(products.items.filter((p) => p.kiotSlug === b.slug)).toHaveLength(0);
    const all = await searchProducts({ q: '', sort: 'moi-nhat', province: 'can-tho' }, 50);
    expect(all.items.some((p) => p.kiotSlug === b.slug)).toBe(true);
  });
});
