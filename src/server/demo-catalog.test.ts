import { describe, expect, it } from 'vitest';
import { DEMO_KIOTS, describeProduct } from './demo-catalog';

describe('nội dung sản phẩm mẫu', () => {
  const products = DEMO_KIOTS.flatMap((k) => k.products.map((p) => ({ ...p, kiot: k })));

  it.each(products.map((p) => [p.name, p]))('%s có mô tả dài, đủ điểm nổi bật và thông số', (_name, p) => {
    expect(p.intro.length).toBeGreaterThanOrEqual(120);
    expect(p.highlights.length).toBeGreaterThanOrEqual(4);
    expect(p.spec.length).toBeGreaterThanOrEqual(5);
    expect(describeProduct(p, p.kiot).length).toBeGreaterThanOrEqual(1000);
    expect(describeProduct(p, p.kiot)).toContain('không bán thật');
  });
});
