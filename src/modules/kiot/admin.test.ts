import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createSeller } from '../../../tests/helpers/factories';
import {
  extendActiveUntil,
  getProductForCheckout,
  hideProduct,
  lockKiot,
  unhideProduct,
  unlockKiot,
} from './admin';
import { getPublicKiot } from './public';

describe('quản trị Kiot', () => {
  it('khoá/mở khoá Kiot kèm lý do', async () => {
    const { kiotId, slug } = await createSeller({ active: true });
    await lockKiot(kiotId, 'Bán hàng giả');
    expect(await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).toMatchObject({
      lockReason: 'Bán hàng giả',
    });
    expect(await getPublicKiot(slug, null)).toBeNull();
    await unlockKiot(kiotId);
    expect(await getPublicKiot(slug, null)).not.toBeNull();
  });

  it('gỡ/khôi phục sản phẩm vi phạm', async () => {
    const { kiotId } = await createSeller({ active: true });
    const p = await db.product.create({
      data: { kiotId, name: 'SP', price: 10_000, stock: 1, category: 'khac' },
    });
    await hideProduct(p.id, 'Hàng cấm');
    expect((await getProductForCheckout(p.id))?.available).toBe(false);
    await unhideProduct(p.id);
    expect((await getProductForCheckout(p.id))?.available).toBe(true);
  });

  it('gia hạn Kiot (billing gọi)', async () => {
    const { kiotId, slug } = await createSeller();
    const until = new Date(Date.now() + 365 * 86_400_000);
    await db.$transaction((tx) => extendActiveUntil(tx, kiotId, until));
    expect((await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil).toEqual(until);
    expect(await getPublicKiot(slug, null)).not.toBeNull();
  });

  it('getProductForCheckout: giá, tồn kho, ảnh, và còn bán được hay không', async () => {
    const { kiotId } = await createSeller({ active: true });
    const p = await db.product.create({
      data: {
        kiotId,
        name: 'Thanh long',
        price: 45_000,
        stock: 3,
        category: 'nong-san',
        images: {
          create: { kiotId, url: '/uploads/a.webp', thumbUrl: '/uploads/a-400.webp', width: 1, height: 1 },
        },
      },
    });
    expect(await getProductForCheckout(p.id)).toEqual({
      id: p.id,
      kiotId,
      name: 'Thanh long',
      price: 45_000,
      stock: 3,
      imageUrl: '/uploads/a-400.webp',
      available: true,
    });
    await db.kiot.update({ where: { id: kiotId }, data: { activeUntil: new Date(Date.now() - 1000) } });
    expect((await getProductForCheckout(p.id))?.available).toBe(false);
    expect(await getProductForCheckout('khong-ton-tai')).toBeNull();
  });
});
