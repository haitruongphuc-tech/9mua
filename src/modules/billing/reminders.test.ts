import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { clearOutbox, getOutbox } from '@/lib/mail';
import { changeEmail } from '@/modules/identity';
import { createSeller } from '../../../tests/helpers/factories';
import { listExpiringKiots, revenueSummary, sendExpiryReminders } from './reminders';

async function sellerExpiringIn(days: number, email = true) {
  const s = await createSeller();
  if (email)
    await changeEmail(s.user.id, {
      email: `s-${s.kiotId}@9mua.com`.toLowerCase(),
      password: s.user.password,
    });
  await db.kiot.update({
    where: { id: s.kiotId },
    data: { activeUntil: new Date(Date.now() + days * 86_400_000) },
  });
  return s;
}

describe('nhắc gia hạn', () => {
  it('gửi đúng mốc 14 ngày, 3 ngày, ngày hết hạn; mỗi mốc 1 lần dù cron chạy 2 lần', async () => {
    setClock(new Date('2026-10-23T01:00:00Z'));
    const s = await sellerExpiringIn(0); // đặt lại activeUntil theo đồng hồ giả bên dưới
    await db.kiot.update({
      where: { id: s.kiotId },
      data: { activeUntil: new Date('2026-11-06T00:00:00Z') },
    }); // còn ~13,9 ngày
    clearOutbox();

    expect(await sendExpiryReminders()).toEqual({ sent: 1 });
    expect(await sendExpiryReminders()).toEqual({ sent: 0 });
    expect(getOutbox()).toHaveLength(1);
    expect(getOutbox()[0]!.subject).toContain('14 ngày');

    advanceClock({ days: 11 }); // còn ~2,9 ngày
    await sendExpiryReminders();
    await sendExpiryReminders();
    expect(getOutbox()).toHaveLength(2);
    expect(getOutbox()[1]!.subject).toContain('3 ngày');

    advanceClock({ days: 3 }); // đã quá hạn vài giờ
    await sendExpiryReminders();
    expect(getOutbox()).toHaveLength(3);
    expect(getOutbox()[2]!.subject).toContain('hết hạn');
    advanceClock({ days: 2 });
    await sendExpiryReminders();
    expect(getOutbox()).toHaveLength(3);
  });

  it('kỳ hạn mới (đã gia hạn) thì được nhắc lại từ đầu', async () => {
    setClock(new Date('2026-10-23T01:00:00Z'));
    const s = await sellerExpiringIn(0);
    await db.kiot.update({
      where: { id: s.kiotId },
      data: { activeUntil: new Date('2026-11-05T00:00:00Z') },
    });
    clearOutbox();
    await sendExpiryReminders();
    await db.kiot.update({
      where: { id: s.kiotId },
      data: { activeUntil: new Date('2027-11-05T00:00:00Z') },
    });
    advanceClock({ days: 365 });
    await sendExpiryReminders();
    expect(getOutbox()).toHaveLength(2);
  });

  it('không có email thì bỏ qua; Kiot bị khoá không nhắc', async () => {
    setClock(new Date('2026-10-23T01:00:00Z'));
    const noEmail = await sellerExpiringIn(0, false);
    await db.kiot.update({
      where: { id: noEmail.kiotId },
      data: { activeUntil: new Date('2026-11-01T00:00:00Z') },
    });
    const locked = await sellerExpiringIn(0);
    await db.kiot.update({
      where: { id: locked.kiotId },
      data: { activeUntil: new Date('2026-11-01T00:00:00Z'), lockedAt: new Date() },
    });
    clearOutbox();
    await sendExpiryReminders();
    expect(getOutbox()).toHaveLength(0);
  });
});

describe('báo cáo cho CEO', () => {
  it('Kiot sắp hết hạn trong N ngày', async () => {
    const soon = await sellerExpiringIn(5);
    await sellerExpiringIn(60);
    const list = await listExpiringKiots(14);
    expect(list.map((k) => k.kiotId)).toEqual([soon.kiotId]);
  });

  it('doanh thu phí thuê theo khoảng thời gian (không tính năm tặng)', async () => {
    const a = await createSeller();
    await db.kiotSubscription.createMany({
      data: [
        {
          kiotId: a.kiotId,
          source: 'payos',
          amount: 26_000,
          periodStart: new Date(),
          periodEnd: new Date(),
          createdAt: new Date('2026-10-10T00:00:00Z'),
        },
        {
          kiotId: a.kiotId,
          source: 'payos',
          amount: 26_000,
          periodStart: new Date(),
          periodEnd: new Date(),
          createdAt: new Date('2026-10-20T00:00:00Z'),
        },
        {
          kiotId: a.kiotId,
          source: 'admin_grant',
          amount: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
          createdAt: new Date('2026-10-20T00:00:00Z'),
        },
        {
          kiotId: a.kiotId,
          source: 'payos',
          amount: 26_000,
          periodStart: new Date(),
          periodEnd: new Date(),
          createdAt: new Date('2026-11-02T00:00:00Z'),
        },
      ],
    });
    expect(
      await revenueSummary({ from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z') }),
    ).toEqual({ count: 2, total: 52_000 });
  });
});
