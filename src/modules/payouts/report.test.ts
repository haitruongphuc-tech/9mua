import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setPayoutAccount } from '@/modules/kiot';
import { createPaidOrder, createUser } from '../../../tests/helpers/factories';
import { creditCompletedOrder } from './ledger';
import { custodyReport } from './report';
import { markPayoutPaid, rejectPayout, requestPayout } from './request';

describe('báo cáo tiền giữ hộ', () => {
  it('tiền vào − hoàn tiền − đã chi = tiền đang giữ + phí sàn', async () => {
    setClock(new Date('2026-10-20T02:00:00Z'));
    const admin = await createUser();
    const a = await createPaidOrder({ price: 200_000 }); // sẽ hoàn tất
    const b = await createPaidOrder({ price: 100_000 }); // bị huỷ, đã hoàn tiền
    await createPaidOrder({ price: 100_000 }); // còn đang giao
    const done = await db.order.update({ where: { id: a.order.id }, data: { status: 'completed' } });
    await db.$transaction((tx) => creditCompletedOrder(tx, done));
    await db.order.update({ where: { id: b.order.id }, data: { status: 'refunded' } });

    const s = a.seller;
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
    await setPayoutAccount(s.user.id, {
      bankBin: '970422',
      accountNumber: '0979393916',
      accountName: 'A B',
      password: s.user.password,
    });
    advanceClock({ days: 2 });
    const p1 = await requestPayout(s.kiotId, s.user.id, 50_000);
    if (!p1.ok) throw new Error(p1.error);
    await markPayoutPaid(p1.payoutId, admin.id, 'FT1');
    const p2 = await requestPayout(s.kiotId, s.user.id, 30_000 + 50_000);
    if (!p2.ok) throw new Error(p2.error);
    await rejectPayout(p2.payoutId, admin.id, 'Thử từ chối');
    const p3 = await requestPayout(s.kiotId, s.user.id, 60_000);
    if (!p3.ok) throw new Error(p3.error);

    const r = await custodyReport({ from: new Date('2026-01-01'), to: new Date('2027-01-01') });
    expect(r).toEqual({
      held: 80_000 + 60_000 + 100_000,
      sellerBalances: 200_000 - 10_000 - 50_000 - 60_000,
      reserved: 60_000,
      pendingOrders: 100_000,
      platformFees: 10_000,
      paidOut: 50_000,
      payoutFees: 0,
    });
    const paidIn = 400_000;
    const refunded = 100_000;
    expect(paidIn - refunded - (r.paidOut + r.payoutFees)).toBe(r.held + r.platformFees);
  });
});
