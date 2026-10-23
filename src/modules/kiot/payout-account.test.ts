import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { changeEmail } from '@/modules/identity';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { getPayoutAccount, normalizeAccountName, setPayoutAccount } from './payout-account';

const account = { bankBin: '970422', accountNumber: '0979 393 916', accountName: 'Nguyễn Hải' };

describe('tài khoản nhận tiền', () => {
  it('chuẩn hoá tên chủ tài khoản: viết hoa, không dấu', () => {
    expect(normalizeAccountName('  Nguyễn  Văn Đức ')).toBe('NGUYEN VAN DUC');
  });

  it('lưu được khi nhập đúng mật khẩu; chuẩn hoá số tài khoản và tên', async () => {
    const { user, kiotId } = await createSeller();
    setClock(new Date('2026-10-23T03:00:00Z'));
    expect(await setPayoutAccount(user.id, { ...account, password: user.password })).toEqual({ ok: true });
    expect(await getPayoutAccount(kiotId)).toEqual({
      bankBin: '970422',
      bankName: 'MB Bank',
      accountNumber: '0979393916',
      accountName: 'NGUYEN HAI',
      changedAt: new Date('2026-10-23T03:00:00Z'),
    });
  });

  it('sai mật khẩu bị từ chối và không lưu gì', async () => {
    const { user, kiotId } = await createSeller();
    expect(await setPayoutAccount(user.id, { ...account, password: 'sai' })).toEqual({
      ok: false,
      error: 'WRONG_PASSWORD',
    });
    expect(await getPayoutAccount(kiotId)).toBeNull();
  });

  it('kiểm ngân hàng, số tài khoản, tên', async () => {
    const { user } = await createSeller();
    const r = await setPayoutAccount(user.id, {
      bankBin: '999999',
      accountNumber: '12ab',
      accountName: 'A',
      password: user.password,
    });
    expect(r).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: {
        bankBin: expect.any(String),
        accountNumber: expect.any(String),
        accountName: expect.any(String),
      },
    });
  });

  it('mỗi lần đổi lưu lịch sử; lấy bản mới nhất; có email báo cho chủ Kiot', async () => {
    const { user, kiotId } = await createSeller();
    await changeEmail(user.id, { email: 'chu-kiot@9mua.com', password: user.password });
    setClock(new Date('2026-10-23T03:00:00Z'));
    await setPayoutAccount(user.id, { ...account, password: user.password });
    advanceClock({ days: 2 });
    await setPayoutAccount(user.id, {
      bankBin: '970436',
      accountNumber: '1234567890',
      accountName: 'NGUYEN HAI',
      password: user.password,
    });
    expect(await db.kiotPayoutAccount.count({ where: { kiotId } })).toBe(2);
    expect(await getPayoutAccount(kiotId)).toMatchObject({ bankBin: '970436', accountNumber: '1234567890' });
    const mails = getOutbox().filter((m) => m.to === 'chu-kiot@9mua.com');
    expect(mails).toHaveLength(2);
    expect(mails[1]!.text).toContain('******7890');
    expect(mails[1]!.text).not.toContain('1234567890');
  });

  it('người chưa có Kiot không đặt được', async () => {
    const user = await createUser();
    expect(await setPayoutAccount(user.id, { ...account, password: user.password })).toEqual({
      ok: false,
      error: 'NO_KIOT',
    });
  });
});
