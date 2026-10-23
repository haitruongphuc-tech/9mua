import { expect, it } from 'vitest';
import { db } from '@/lib/db';
import { searchProducts } from '@/modules/marketplace';
import { createSeller } from '../helpers/factories';

// SPEC-marketplace.md mục 3: mỗi lần tìm < 300ms với 100.000 sản phẩm (đo p95).
it('tìm kiếm trên 100.000 sản phẩm: p95 < 300ms', { timeout: 600_000 }, async () => {
  const kiots: string[] = [];
  for (let i = 0; i < 50; i++) kiots.push((await createSeller({ active: true })).kiotId);
  await db.$executeRawUnsafe(`
    INSERT INTO "Product" (id, "kiotId", name, description, price, stock, category, "createdAt", "updatedAt")
    SELECT 'perf' || g,
      (ARRAY['${kiots.join("','")}'])[1 + g % 50],
      (ARRAY['Thanh long','Xoài cát','Áo thun','Nón lá','Cà phê','Mật ong','Gạo ST25','Bánh pía','Nước mắm','Trà xanh',
             'Son môi','Giày da','Túi xách','Đồng hồ','Tai nghe','Sữa chua','Tôm khô','Mực một nắng','Hạt điều','Chả lụa'])[1 + g % 20]
        || ' ' || (ARRAY['Bình Thuận','Đà Lạt','Phú Quốc','Hà Giang','Sóc Trăng','loại 1','cao cấp','handmade','chính hãng','giá rẻ'])[1 + (g / 20) % 10]
        || ' ' || g,
      'Mô tả sản phẩm số ' || g || ' giao nhanh toàn quốc',
      1000 + (g * 37) % 2000000, g % 13, 
      (ARRAY['nong-san','thoi-trang','thuc-pham-dac-san','dien-tu','my-pham'])[1 + g % 5],
      now() - (g || ' seconds')::interval, now()
    FROM generate_series(1, 100000) g`);
  await db.$executeRawUnsafe('ANALYZE "Product"');

  const queries = [
    { q: 'thanh long', sort: 'phu-hop' as const },
    { q: 'thnah long', sort: 'phu-hop' as const },
    { q: 'ao thun', sort: 'phu-hop' as const },
    { q: 'mật ong', sort: 'phu-hop' as const },
    { q: 'ca phe da lat', sort: 'phu-hop' as const },
    { q: 'gao', sort: 'gia-tang' as const },
    { sort: 'moi-nhat' as const },
    { sort: 'ban-chay' as const, category: 'nong-san' },
    { sort: 'gia-giam' as const, priceMin: 50_000, priceMax: 500_000 },
    { q: 'dong ho chinh hang', sort: 'phu-hop' as const },
  ];
  const timings: number[] = [];
  for (let round = 0; round < 5; round++)
    for (const params of queries) {
      const start = performance.now();
      const page = await searchProducts(params);
      timings.push(performance.now() - start);
      if (round === 1)
        console.info(`[perf] ${JSON.stringify(params)} ${(performance.now() - start).toFixed(0)}ms`);
      if (round === 0 && 'q' in params) expect(page.items.length, params.q).toBeGreaterThan(0);
    }
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.floor(timings.length * 0.95)]!;
  console.info(
    `[perf] tìm kiếm 100k sản phẩm: p50 ${timings[timings.length / 2]!.toFixed(0)}ms, p95 ${p95.toFixed(0)}ms`,
  );
  expect(p95).toBeLessThan(300);
});
