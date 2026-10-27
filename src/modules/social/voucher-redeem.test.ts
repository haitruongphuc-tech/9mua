import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createSeller } from '../../../tests/helpers/factories';
import { getVoucher, listVouchers, redeemVoucher, revokeVoucher } from './index';

async function sellerWithVoucher(active = false) {
  const seller = await createSeller({ active });
  const v = await db.kiotVoucher.create({ data: { userId: seller.user.id } });
  return { ...seller, voucherId: v.id };
}

describe('dùng voucher mở Kiot (SPEC-billing.md bổ sung 27/10)', () => {
  it('Kiot nháp dùng voucher: kích hoạt 1 năm, ghi kỳ nguồn voucher 0đ, voucher đã dùng', async () => {
    const { user, kiotId } = await sellerWithVoucher();
    const r = await redeemVoucher(user.id);
    expect(r.ok).toBe(true);
    const kiot = await db.kiot.findUniqueOrThrow({ where: { id: kiotId } });
    expect(kiot.activeUntil!.getTime()).toBeGreaterThan(Date.now() + 360 * 86_400_000);
    expect(await db.kiotSubscription.findFirstOrThrow({ where: { kiotId } })).toMatchObject({
      source: 'voucher',
      amount: 0,
    });
    expect(await getVoucher(user.id)).toMatchObject({ usable: false, usedAt: expect.any(Date) });
    expect((await db.kiotVoucher.findFirstOrThrow({ where: { userId: user.id } })).kiotId).toBe(kiotId);
  });

  it('Kiot đang hoạt động dùng voucher thì cộng dồn thêm 1 năm', async () => {
    const { user, kiotId } = await sellerWithVoucher(true);
    const before = (await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil!;
    expect((await redeemVoucher(user.id)).ok).toBe(true);
    const after = (await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil!;
    expect(after.getTime() - before.getTime()).toBeGreaterThan(364 * 86_400_000);
  });

  it('bấm 2 lần cùng lúc chỉ dùng được 1 lần', async () => {
    const { user, kiotId } = await sellerWithVoucher();
    const results = await Promise.all([redeemVoucher(user.id), redeemVoucher(user.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: 'NO_VOUCHER' });
    expect(await db.kiotSubscription.count({ where: { kiotId } })).toBe(1);
  });

  it('voucher bị CEO thu hồi, không có voucher, Kiot bị khoá thì không dùng được', async () => {
    const { user, voucherId } = await sellerWithVoucher();
    expect((await revokeVoucher(voucherId, 'admin-1', 'Tài khoản ảo')).ok).toBe(true);
    expect(await redeemVoucher(user.id)).toEqual({ ok: false, error: 'NO_VOUCHER' });
    const none = await createSeller();
    expect(await redeemVoucher(none.user.id)).toEqual({ ok: false, error: 'NO_VOUCHER' });
    const locked = await sellerWithVoucher();
    await db.kiot.update({ where: { id: locked.kiotId }, data: { lockedAt: new Date() } });
    expect(await redeemVoucher(locked.user.id)).toEqual({ ok: false, error: 'KIOT_LOCKED' });
    expect(await db.kiotSubscription.count()).toBe(0);
  });

  it('danh sách voucher cho CEO có tên và SĐT người nhận', async () => {
    const { user } = await sellerWithVoucher();
    const rows = await listVouchers();
    expect(rows[0]).toMatchObject({ userId: user.id, user: { displayName: expect.any(String), phone: expect.any(String) } });
  });
});
