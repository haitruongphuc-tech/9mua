import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from './clock';
import { db } from './db';
import { alertCeo, flushAlerts } from './alerts';
import { getOutbox } from './mail';
import { createUser } from '../../tests/helpers/factories';

async function makeAdmin(email: string) {
  const u = await createUser();
  await db.user.update({ where: { id: u.id }, data: { role: 'admin', email } });
}

describe('cảnh báo CEO', () => {
  it('gửi ngay sự việc đầu; các sự việc trong 15 phút sau gộp vào đúng 1 email', async () => {
    setClock(new Date('2026-10-23T03:00:00Z'));
    await makeAdmin('ceo@9mua.test');
    await alertCeo('payout_failed', 'Lệnh RT100001 lỗi');
    expect(getOutbox()).toHaveLength(1);
    expect(getOutbox()[0]).toMatchObject({ to: 'ceo@9mua.test', subject: '[9MUA] Lệnh chi PayOS lỗi' });

    for (let i = 2; i <= 11; i++) {
      advanceClock({ minutes: 1 });
      await alertCeo('payout_failed', `Lệnh RT1000${String(i).padStart(2, '0')} lỗi`);
    }
    expect(getOutbox()).toHaveLength(1);
    expect(await flushAlerts()).toBe(0); // vẫn trong 15 phút

    advanceClock({ minutes: 6 });
    expect(await flushAlerts()).toBe(1);
    const merged = getOutbox()[1]!;
    expect(merged.subject).toBe('[9MUA] Lệnh chi PayOS lỗi (10 việc)');
    expect(merged.text).toContain('RT100002');
    expect(merged.text).toContain('RT100011');
    expect(await flushAlerts()).toBe(0);
  });

  it('mỗi loại cảnh báo có hạn mức riêng; admin bị khoá không nhận', async () => {
    await makeAdmin('ceo@9mua.test');
    const locked = await createUser();
    await db.user.update({
      where: { id: locked.id },
      data: { role: 'admin', email: 'cu@9mua.test', lockedAt: new Date() },
    });
    await alertCeo('payout_failed', 'a');
    await alertCeo('payout_fund_low', 'b');
    expect(getOutbox().map((m) => m.to)).toEqual(['ceo@9mua.test', 'ceo@9mua.test']);
  });

  it('không có admin nào có email: không ném lỗi', async () => {
    await expect(alertCeo('payout_failed', 'x')).resolves.toBeUndefined();
    expect(getOutbox()).toHaveLength(0);
  });
});
