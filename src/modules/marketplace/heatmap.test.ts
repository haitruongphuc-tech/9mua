import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { buildCsp } from '@/lib/security-headers';
import { createProduct, createSeller } from '../../../tests/helpers/factories';
import { kiotHeatmap, validBounds } from './heatmap';
import { searchKiots } from './kiot-search';

describe('bản đồ nhiệt Kiot (SPEC-marketplace.md V5.3)', () => {
  it('đếm Kiot theo ô ~1,1 km trong khung; bấm ô ra đúng Kiot; không trả toạ độ từng Kiot', async () => {
    // Khung nhỏ ở một nơi không có Kiot thử nào khác.
    const base = { lat: 9.5 + Math.random() * 0.4, lng: 104.85 + Math.random() * 0.05 };
    const make = async (dLat: number) => {
      const s = await createSeller({ active: true });
      await db.kiot.update({
        where: { id: s.kiotId },
        data: { lat: base.lat + dLat, lng: base.lng, geoSource: 'pin' },
      });
      await createProduct(s.kiotId);
      return s;
    };
    const a = await make(0.0001);
    const b = await make(0.0002);
    const c = await make(0.05);
    const bounds = validBounds({
      south: base.lat - 0.1,
      west: base.lng - 0.1,
      north: base.lat + 0.1,
      east: base.lng + 0.1,
    })!;
    const { cells } = await kiotHeatmap(bounds);
    expect(cells.map((x) => x.count).sort()).toEqual([1, 2]);
    expect(Object.keys(cells[0]!).sort()).toEqual(['count', 'lat', 'lng']);
    const dense = cells.find((x) => x.count === 2)!;
    const inCell = await searchKiots({ cell: dense });
    expect(inCell.items.map((k) => k.slug).sort()).toEqual([a.slug, b.slug].sort());
    expect(inCell.items.some((k) => k.slug === c.slug)).toBe(false);
    expect(validBounds({ south: 1, west: 2, north: 0, east: 3 })).toBeNull();
  });

  it('CSP cho phép máy chủ ảnh nền bản đồ (cả mẫu {s})', () => {
    const csp = buildCsp(
      'n',
      'https://9mua.com',
      undefined,
      false,
      'https://{s}.tile.example.com/{z}/{x}/{y}.png',
    );
    expect(csp).toContain("img-src 'self' data: blob: https://*.tile.example.com;");
  });
});
