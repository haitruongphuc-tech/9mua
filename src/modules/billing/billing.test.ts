import { describe, expect, it } from 'vitest';
import '@/server/payments';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { changeEmail } from '@/modules/identity';
import { getPublicKiot, lockKiot } from '@/modules/kiot';
import { getPayment } from '@/server/payments';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { simulatePaid } from '../../../tests/helpers/payments';
import { getKiotBilling, getKiotFee, grantYear, setKiotFee, startKiotPayment } from './index';

async function pay(userId: string, kiotId: string) {
  const r = await startKiotPayment(kiotId, userId);
  if (!r.ok) throw new Error(JSON.stringify(r));
  const p = await getPayment(r.intentId);
  await simulatePaid(p!.orderCode);
  return r.intentId;
}

describe('kích hoạt Kiot', () => {
  it('phí mặc định 26.000đ', async () => {
    expect(await getKiotFee()).toBe(26_000);
  });

  it('nháp → trả 26.000đ → công khai đúng 1 năm, có lịch sử và email biên nhận', async () => {
    setClock(new Date('2026-10-23T03:00:00Z'));
    const { user, kiotId, slug } = await createSeller();
    await changeEmail(user.id, { email: 'seller@9mua.com', password: user.password });
    const r = await startKiotPayment(kiotId, user.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const intent = await getPayment(r.intentId);
    expect(intent).toMatchObject({
      amount: 26_000,
      purpose: 'kiot_fee',
      refId: kiotId,
      description: expect.stringMatching(/^KIOT[A-Z0-9]{1,5}$/),
    });

    await simulatePaid(intent!.orderCode);
    expect((await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil).toEqual(
      new Date('2027-10-23T03:00:00Z'),
    );
    expect(await getPublicKiot(slug, null)).not.toBeNull();
    const billing = await getKiotBilling(kiotId);
    expect(billing.history).toEqual([
      expect.objectContaining({
        source: 'payos',
        amount: 26_000,
        periodEnd: new Date('2027-10-23T03:00:00Z'),
      }),
    ]);
    const mail = getOutbox().find((m) => m.to === 'seller@9mua.com' && m.subject.includes('Biên nhận'));
    expect(mail?.text).toContain('26.000đ');
  });

  it('gia hạn khi còn 100 ngày: hạn mới = hạn cũ + 1 năm', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { user, kiotId } = await createSeller();
    await pay(user.id, kiotId);
    advanceClock({ days: 265 });
    await pay(user.id, kiotId);
    expect((await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil).toEqual(
      new Date('2028-10-23T00:00:00Z'),
    );
  });

  it('webhook gửi trùng không cộng thêm năm', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { user, kiotId } = await createSeller();
    const r = await startKiotPayment(kiotId, user.id);
    if (!r.ok) throw new Error();
    const p = await getPayment(r.intentId);
    const { body } = await simulatePaid(p!.orderCode);
    const { handleWebhook } = await import('@/server/payments');
    await handleWebhook(body);
    expect(await db.kiotSubscription.count()).toBe(1);
    expect((await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil).toEqual(
      new Date('2027-10-23T00:00:00Z'),
    );
  });

  it('đổi giá khi đang có QR chờ: QR cũ vẫn kích hoạt được, QR mới dùng giá mới', async () => {
    const admin = await createUser();
    const a = await createSeller();
    const old = await startKiotPayment(a.kiotId, a.user.id);
    await setKiotFee(30_000, admin.id);
    const b = await createSeller();
    const fresh = await startKiotPayment(b.kiotId, b.user.id);
    if (!old.ok || !fresh.ok) throw new Error();
    expect((await getPayment(old.intentId))?.amount).toBe(26_000);
    expect((await getPayment(fresh.intentId))?.amount).toBe(30_000);
    await simulatePaid((await getPayment(old.intentId))!.orderCode);
    expect((await db.kiot.findUniqueOrThrow({ where: { id: a.kiotId } })).activeUntil).not.toBeNull();
    await expect(setKiotFee(1999, admin.id)).rejects.toThrow();
  });

  it('Kiot bị khoá hoặc người không phải chủ thì không tạo được thanh toán', async () => {
    const { user, kiotId } = await createSeller();
    const stranger = await createUser();
    expect(await startKiotPayment(kiotId, stranger.id)).toEqual({ ok: false, error: 'NOT_OWNER' });
    await lockKiot(kiotId, 'vi phạm');
    expect(await startKiotPayment(kiotId, user.id)).toEqual({ ok: false, error: 'KIOT_LOCKED' });
  });

  it('CEO tặng 1 năm: ghi người cấp và lý do', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const admin = await createUser();
    const { kiotId } = await createSeller();
    await grantYear(kiotId, admin.id, 'Đối tác ra mắt');
    expect((await db.kiot.findUniqueOrThrow({ where: { id: kiotId } })).activeUntil).toEqual(
      new Date('2027-10-23T00:00:00Z'),
    );
    expect((await getKiotBilling(kiotId)).history[0]).toMatchObject({
      source: 'admin_grant',
      amount: 0,
      grantedById: admin.id,
      note: 'Đối tác ra mắt',
    });
  });
});
