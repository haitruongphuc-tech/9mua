import { describe, expect, it } from 'vitest';
import { now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { createPaidOrder, createUser } from '../../../tests/helpers/factories';
import { remindRefundAccounts, sendDailyDigest } from './digest';

async function ceo() {
  const u = await createUser();
  await db.user.update({ where: { id: u.id }, data: { role: 'admin', email: 'ceo@9mua.test' } });
}

describe('bản tin 8:00', () => {
  it('có số liệu hôm qua và việc cần làm', async () => {
    setClock(new Date('2026-10-22T05:00:00Z')); // trưa 22/10 giờ VN
    await ceo();
    const o = await createPaidOrder({ price: 80_000 });
    await db.order.update({ where: { id: o.order.id }, data: { status: 'refund_pending' } });
    setClock(new Date('2026-10-23T01:00:00Z')); // 8:00 sáng 23/10
    expect(await sendDailyDigest()).toEqual({ sent: 1 });
    const mail = getOutbox().find((m) => m.to === 'ceo@9mua.test')!;
    expect(mail.subject).toBe('[9MUA] Bản tin ngày 22/10/2026');
    expect(mail.text).toContain('Đơn đã trả: 1 đơn, 80.000đ');
    expect(mail.text).toContain('Đơn chờ hoàn tiền: 1');
  });

  it('nhắc người mua nhập tài khoản hoàn tiền sau 24 giờ', async () => {
    setClock(new Date('2026-10-21T01:00:00Z'));
    const o = await createPaidOrder();
    await db.user.update({ where: { id: o.buyer.id }, data: { email: 'mua@9mua.test' } });
    await db.order.update({
      where: { id: o.order.id },
      data: { status: 'refund_pending', updatedAt: now() },
    });
    expect(await remindRefundAccounts()).toEqual({ reminded: 0 }); // chưa đủ 24 giờ
    setClock(new Date('2026-10-22T02:00:00Z'));
    expect(await remindRefundAccounts()).toEqual({ reminded: 1 });
    expect(getOutbox().at(-1)).toMatchObject({ to: 'mua@9mua.test' });
    await db.order.update({
      where: { id: o.order.id },
      data: { refundAccount: { bankBin: '970422', accountNumber: '0123456789', accountName: 'A' } },
    });
    expect(await remindRefundAccounts()).toEqual({ reminded: 0 });
  });
});

describe('báo CEO ngay', () => {
  it('khiếu nại mới gửi email cảnh báo', async () => {
    await ceo();
    const { submitDispute } = await import('@/modules/orders');
    const o = await createPaidOrder();
    await db.order.update({
      where: { id: o.order.id },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
    expect(
      await submitDispute(o.buyer.id, o.order.id, { message: 'Hàng bị dập, không đúng mô tả', images: [] }),
    ).toMatchObject({ ok: true });
    expect(getOutbox().some((m) => m.to === 'ceo@9mua.test' && m.subject === '[9MUA] Khiếu nại mới')).toBe(
      true,
    );
  });
});
