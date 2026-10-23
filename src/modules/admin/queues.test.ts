import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setPayoutAccount } from '@/modules/kiot';
import { requestPayout } from '@/modules/payouts';
import { createPaidOrder, createSeller, createUser } from '../../../tests/helpers/factories';
import {
  approvePayout,
  markOrderRefunded,
  rejectPayoutRequest,
  resolveDispute,
  reviewKycSubmission,
} from './queues';

async function sellerWithPayout() {
  setClock(new Date('2026-10-20T02:00:00Z'));
  const s = await createSeller({ active: true });
  await setPayoutAccount(s.user.id, {
    bankBin: '970422',
    accountNumber: '0979393916',
    accountName: 'A B',
    password: s.user.password,
  });
  await db.kycSubmission.create({
    data: {
      userId: s.user.id,
      fullName: 'A B',
      idNumber: '079123456789',
      frontImage: 'x',
      backImage: 'y',
      status: 'approved',
    },
  });
  await db.balanceEntry.create({
    data: { kiotId: s.kiotId, type: 'order_credit', amount: 500_000, refId: `seed-${s.kiotId}` },
  });
  advanceClock({ days: 2 });
  const r = await requestPayout(s.kiotId, s.user.id, 100_000);
  if (!r.ok) throw new Error(r.error);
  return { s, payoutId: r.payoutId };
}

describe('hàng chờ của CEO ghi nhật ký', () => {
  it('từ chối rút tiền: đúng 1 dòng nhật ký có trước/sau; thao tác lỗi không ghi', async () => {
    const admin = await createUser();
    const { payoutId } = await sellerWithPayout();
    expect(await rejectPayoutRequest(admin.id, payoutId, '')).toMatchObject({ ok: false });
    expect(await db.adminAuditLog.count()).toBe(0);
    expect(await rejectPayoutRequest(admin.id, payoutId, 'Sai tên chủ tài khoản')).toEqual({ ok: true });
    const logs = await db.adminAuditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      adminId: admin.id,
      action: 'payout.reject',
      targetType: 'payout',
      targetId: payoutId,
      reason: 'Sai tên chủ tài khoản',
      before: expect.objectContaining({ status: 'pending' }),
      after: expect.objectContaining({ status: 'rejected', rejectReason: 'Sai tên chủ tài khoản' }),
    });
  });

  it('Chi qua PayOS (driver giả): processing và có nhật ký', async () => {
    const admin = await createUser();
    const { payoutId } = await sellerWithPayout();
    expect(await approvePayout(admin.id, payoutId)).toMatchObject({ ok: true });
    expect(await db.adminAuditLog.findFirstOrThrow()).toMatchObject({
      action: 'payout.approve_payos',
      after: expect.objectContaining({ status: 'processing', mode: 'manual' }),
    });
  });

  it('duyệt KYC; khiếu nại trả cho người bán thì đơn hoàn tất và cộng số dư', async () => {
    const admin = await createUser();
    const s = await createSeller();
    const kyc = await db.kycSubmission.create({
      data: { userId: s.user.id, fullName: 'A B', idNumber: '079123456789', frontImage: 'x', backImage: 'y' },
    });
    expect(await reviewKycSubmission(admin.id, kyc.id, 'approve', '')).toEqual({ ok: true });

    const o = await createPaidOrder();
    await db.order.update({ where: { id: o.order.id }, data: { status: 'disputed' } });
    expect(await resolveDispute(admin.id, o.order.id, 'release', 'Người bán đã giao đúng hàng')).toEqual({
      ok: true,
    });
    expect((await db.order.findUniqueOrThrow({ where: { id: o.order.id } })).status).toBe('completed');
    expect(await db.balanceEntry.count({ where: { kiotId: o.seller.kiotId, type: 'order_credit' } })).toBe(1);

    const o2 = await createPaidOrder();
    await db.order.update({ where: { id: o2.order.id }, data: { status: 'refund_pending' } });
    expect(await markOrderRefunded(admin.id, o2.order.id, 'FT26296000001')).toEqual({ ok: true });
    expect(await db.adminAuditLog.findMany({ orderBy: { createdAt: 'asc' } })).toMatchObject([
      { action: 'kyc.approve' },
      { action: 'dispute.release', before: { status: 'disputed' }, after: { status: 'completed' } },
      { action: 'order.mark_refunded', after: { status: 'refunded', refundRef: 'FT26296000001' } },
    ]);
  });
});
