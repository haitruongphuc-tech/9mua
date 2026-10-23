import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import { listReports, reportProduct } from './reports';
import { searchProducts } from './search';

describe('báo cáo vi phạm', () => {
  it('5 người khác nhau báo thì tự ẩn; 1 người báo 5 lần không tính', async () => {
    const s = await createSeller({ active: true });
    const p = await createProduct(s.kiotId, { name: 'Đồng hồ nhái' });
    const spammer = await createUser();
    for (let i = 0; i < 5; i++)
      expect(await reportProduct(spammer.id, p.id, 'hang_gia', 'nhái')).toEqual({
        ok: true,
        autoHidden: false,
      });
    expect(await db.productReport.count()).toBe(1);

    for (let i = 0; i < 3; i++) {
      const u = await createUser();
      expect(await reportProduct(u.id, p.id, i === 0 ? 'lua_dao' : 'hang_gia', '')).toMatchObject({
        autoHidden: false,
      });
    }
    expect((await searchProducts({ sort: 'moi-nhat' })).items).toHaveLength(1);
    const fifth = await createUser();
    expect(await reportProduct(fifth.id, p.id, 'cam_ban', 'hàng cấm')).toEqual({
      ok: true,
      autoHidden: true,
    });
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      hiddenReason: 'Tự ẩn: 5 người báo cáo vi phạm, chờ CEO xem',
    });
    expect((await searchProducts({ sort: 'moi-nhat' })).items).toHaveLength(0);

    const [view] = await listReports();
    expect(view).toMatchObject({
      productId: p.id,
      productName: 'Đồng hồ nhái',
      reporters: 5,
      reasons: { hang_gia: 3, lua_dao: 1, cam_ban: 1 },
      hidden: true,
    });
    expect(view!.messages).toEqual(expect.arrayContaining(['nhái', 'hàng cấm']));
  });

  it('kiểm lý do; không tự báo sản phẩm của mình; sản phẩm không còn bán thì không báo được', async () => {
    const s = await createSeller({ active: true });
    const p = await createProduct(s.kiotId);
    const u = await createUser();
    expect(await reportProduct(u.id, p.id, 'vui', '')).toMatchObject({ ok: false, error: 'INVALID_INPUT' });
    expect(await reportProduct(s.user.id, p.id, 'khac', '')).toEqual({ ok: false, error: 'OWN_PRODUCT' });
    await db.product.update({ where: { id: p.id }, data: { visible: false } });
    expect(await reportProduct(u.id, p.id, 'khac', '')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await reportProduct(u.id, 'khong-co', 'khac', '')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
