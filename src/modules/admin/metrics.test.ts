import { describe, expect, it } from 'vitest';
import { now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createPaidOrder, createSeller, createUser } from '../../../tests/helpers/factories';
import { getMetrics, getTodo, revenueByDay } from './metrics';

describe('tổng quan CEO', () => {
  it('số liệu khớp dữ liệu mẫu', async () => {
    setClock(new Date('2026-10-23T05:00:00Z')); // 12:00 giờ VN
    const o1 = await createPaidOrder({ price: 100_000 });
    await createPaidOrder({ price: 50_000 });
    await db.platformRevenue.create({
      data: { orderId: o1.order.id, kiotId: o1.seller.kiotId, fee: 5_000, createdAt: now() },
    });
    await db.kiotSubscription.create({
      data: {
        kiotId: o1.seller.kiotId,
        source: 'payos',
        amount: 26_000,
        periodStart: new Date(),
        periodEnd: new Date(),
        createdAt: now(),
      },
    });
    await db.kiotSubscription.create({
      data: {
        kiotId: o1.seller.kiotId,
        source: 'admin_grant',
        amount: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    });
    // Dữ liệu cũ hơn 7 ngày: không vào "Hôm nay"/"7 ngày".
    const old = await createUser();
    await db.user.update({ where: { id: old.id }, data: { createdAt: new Date('2026-10-01T00:00:00Z') } });

    const today = await getMetrics('hom-nay');
    expect(today).toMatchObject({
      newUsers: 4, // 2 người bán + 2 người mua; "old" bị loại
      newKiots: 2,
      activeKiots: 2,
      gmv: 150_000,
      platformFees: 5_000,
      kiotFees: 26_000,
      paidOut: 0,
    });
    expect((await getMetrics('30-ngay')).newUsers).toBe(5);

    const series = await revenueByDay(7);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual({ day: '2026-10-23', platform: 5_000, kiot: 26_000 });
    expect(series[0]!.day).toBe('2026-10-17');
  });

  it('hộp "Cần xử lý" chỉ hiện việc có số lượng > 0, kèm link đúng hàng chờ', async () => {
    expect(await getTodo()).toEqual([]);
    const s = await createSeller({ active: true });
    await db.kycSubmission.create({
      data: { userId: s.user.id, fullName: 'A', idNumber: '079123456789', frontImage: 'x', backImage: 'y' },
    });
    const o = await createPaidOrder();
    await db.order.update({ where: { id: o.order.id }, data: { status: 'refund_pending' } });
    expect(await getTodo()).toEqual([
      { key: 'kyc', label: 'KYC chờ duyệt', count: 1, href: '/admin/kyc' },
      { key: 'refunds', label: 'Đơn chờ hoàn tiền', count: 1, href: '/admin/hoan-tien', urgent: true },
    ]);
  });
});
