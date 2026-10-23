import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { setSetting } from '@/lib/settings';
import { setPayoutAccount } from '@/modules/kiot';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { adjustBalance, getBalance } from './ledger';
import {
  cancelPayout,
  listPayoutsForKiot,
  manualTransferQr,
  markPayoutPaid,
  rejectPayout,
  requestPayout,
} from './request';
import { parseTlv } from './vietqr';

// Người bán đủ điều kiện rút: KYC đã duyệt, tài khoản nhận đã đặt > 24 giờ, số dư sẵn.
async function readySeller(balance = 500_000) {
  setClock(new Date('2026-10-20T00:00:00Z'));
  const s = await createSeller({ active: true });
  await setPayoutAccount(s.user.id, {
    bankBin: '970422',
    accountNumber: '0979393916',
    accountName: 'NGUYEN HAI',
    password: s.user.password,
  });
  await db.kycSubmission.create({
    data: {
      userId: s.user.id,
      fullName: 'NGUYEN HAI',
      idNumber: '079123456789',
      frontImage: 'x',
      backImage: 'y',
      status: 'approved',
    },
  });
  await db.balanceEntry.create({
    data: { kiotId: s.kiotId, type: 'order_credit', amount: balance, refId: `seed-${s.kiotId}` },
  });
  advanceClock({ days: 2 });
  return s;
}

describe('yêu cầu rút tiền', () => {
  it('tạo yêu cầu: số dư giảm ngay, chụp tài khoản nhận và phí chi hộ', async () => {
    const s = await readySeller();
    await setSetting('payout_fee_vnd', '2000', null);
    const r = await requestPayout(s.kiotId, s.user.id, 100_000);
    expect(r.ok).toBe(true);
    expect((await getBalance(s.kiotId)).available).toBe(400_000);
    const p = await db.payoutRequest.findFirstOrThrow();
    expect(p).toMatchObject({
      amount: 100_000,
      fee: 2_000,
      netAmount: 98_000,
      bankBin: '970422',
      accountNumber: '0979393916',
      accountName: 'NGUYEN HAI',
      status: 'pending',
    });
    expect(p.code).toMatch(/^RT\d{6}$/);
    // Đổi phí sau khi tạo không ảnh hưởng yêu cầu cũ.
    await setSetting('payout_fee_vnd', '9000', null);
    expect((await db.payoutRequest.findFirstOrThrow()).netAmount).toBe(98_000);
  });

  it('QR chuyển tay đọc lại đúng STK, số tiền sau phí và nội dung', async () => {
    const s = await readySeller();
    await setSetting('payout_fee_vnd', '2000', null);
    const r = await requestPayout(s.kiotId, s.user.id, 50_000);
    if (!r.ok) throw new Error(r.error);
    const top = parseTlv(
      manualTransferQr(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })),
    );
    expect(top['54']).toBe('48000');
    expect(parseTlv(parseTlv(top['38']!)['01']!)).toEqual({ '00': '970422', '01': '0979393916' });
    expect(parseTlv(top['62']!)['08']).toBe(`9MUA RUT ${r.code}`);
  });

  it('các điều kiện bắt buộc', async () => {
    const noKyc = await createSeller({ active: true });
    expect(await requestPayout(noKyc.kiotId, noKyc.user.id, 100_000)).toMatchObject({
      ok: false,
      error: 'KYC_REQUIRED',
    });

    const s = await readySeller(100_000);
    expect(await requestPayout(s.kiotId, s.user.id, 49_999)).toMatchObject({ ok: false, error: 'BELOW_MIN' });
    expect(await requestPayout(s.kiotId, s.user.id, 100_001)).toMatchObject({
      ok: false,
      error: 'INSUFFICIENT',
    });

    // Vừa đổi tài khoản nhận tiền → chặn 24 giờ.
    await setPayoutAccount(s.user.id, {
      bankBin: '970436',
      accountNumber: '1111111111',
      accountName: 'NGUYEN HAI',
      password: s.user.password,
    });
    expect(await requestPayout(s.kiotId, s.user.id, 60_000)).toMatchObject({
      ok: false,
      error: 'ACCOUNT_RECENTLY_CHANGED',
    });
    advanceClock({ hours: 25 });
    expect(await requestPayout(s.kiotId, s.user.id, 60_000)).toMatchObject({ ok: true });
    expect(await requestPayout(s.kiotId, s.user.id, 50_000)).toMatchObject({
      ok: false,
      error: 'HAS_PENDING',
    });

    // Không phải chủ Kiot thì không rút được tiền của Kiot đó.
    const stranger = await createUser();
    expect(await requestPayout(s.kiotId, stranger.id, 60_000)).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('chưa khai báo tài khoản nhận', async () => {
    const s = await createSeller({ active: true });
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
    expect(await requestPayout(s.kiotId, s.user.id, 60_000)).toMatchObject({
      ok: false,
      error: 'NO_ACCOUNT',
    });
  });

  it('10 yêu cầu song song, mỗi cái bằng toàn bộ số dư: đúng 1 cái thành công, số dư không âm', async () => {
    const s = await readySeller(300_000);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => requestPayout(s.kiotId, s.user.id, 300_000)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await getBalance(s.kiotId)).available).toBe(0);
    expect(await db.payoutRequest.count()).toBe(1);
  });

  it('phí chi hộ ≥ số tiền rút thì từ chối', async () => {
    const s = await readySeller();
    await setSetting('payout_fee_vnd', '60000', null);
    expect(await requestPayout(s.kiotId, s.user.id, 60_000)).toMatchObject({ ok: false, error: 'BELOW_MIN' });
  });
});

describe('huỷ / duyệt tay / từ chối', () => {
  it('người bán huỷ khi đang chờ: số dư quay về như cũ', async () => {
    const s = await readySeller(200_000);
    const r = await requestPayout(s.kiotId, s.user.id, 150_000);
    if (!r.ok) throw new Error();
    expect(await cancelPayout(r.payoutId, s.user.id)).toEqual({ ok: true });
    expect((await getBalance(s.kiotId)).available).toBe(200_000);
    expect(await cancelPayout(r.payoutId, s.user.id)).toEqual({ ok: false, error: 'NOT_CANCELLABLE' });
  });

  it('CEO từ chối: cần lý do, hoàn số dư; CEO đánh dấu đã chuyển: cần mã giao dịch', async () => {
    const admin = await createUser();
    const s = await readySeller(200_000);
    const r1 = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r1.ok) throw new Error();
    expect(await rejectPayout(r1.payoutId, admin.id, '')).toEqual({ ok: false, error: 'REASON_REQUIRED' });
    expect(await rejectPayout(r1.payoutId, admin.id, 'Tài khoản không khớp tên')).toEqual({ ok: true });
    expect((await getBalance(s.kiotId)).available).toBe(200_000);

    const r2 = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r2.ok) throw new Error();
    expect(await markPayoutPaid(r2.payoutId, admin.id, '')).toEqual({
      ok: false,
      error: 'BANK_REF_REQUIRED',
    });
    expect(await markPayoutPaid(r2.payoutId, admin.id, 'FT26296123456')).toEqual({ ok: true });
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r2.payoutId } })).toMatchObject({
      status: 'paid',
      mode: 'manual',
      bankRef: 'FT26296123456',
      processedById: admin.id,
    });
    expect((await getBalance(s.kiotId)).available).toBe(100_000);
    expect(await rejectPayout(r2.payoutId, admin.id, 'muộn')).toEqual({ ok: false, error: 'NOT_PENDING' });
  });

  it('email báo người bán khi bị từ chối và khi đã chuyển tiền', async () => {
    const admin = await createUser();
    const s = await readySeller(200_000);
    await db.user.update({ where: { id: s.user.id }, data: { email: 'ban@9mua.test' } });
    const r1 = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r1.ok) throw new Error();
    await rejectPayout(r1.payoutId, admin.id, 'Sai tên');
    const r2 = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r2.ok) throw new Error();
    await markPayoutPaid(r2.payoutId, admin.id, 'FT1');
    const mails = getOutbox().filter((m) => m.to === 'ban@9mua.test');
    expect(mails.map((m) => m.subject)).toEqual([
      `Yêu cầu rút ${r1.code} bị từ chối`,
      `Đã chuyển 100.000đ cho yêu cầu rút ${r2.code}`,
    ]);
    expect(mails[0]!.text).toContain('Sai tên');
  });

  it('yêu cầu giữ tài khoản lúc tạo dù người bán đổi tài khoản sau đó', async () => {
    const s = await readySeller();
    const r = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r.ok) throw new Error();
    await setPayoutAccount(s.user.id, {
      bankBin: '970436',
      accountNumber: '9999999999',
      accountName: 'KE GIAN',
      password: s.user.password,
    });
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      accountNumber: '0979393916',
    });
    expect((await listPayoutsForKiot(s.kiotId))[0]).toMatchObject({ accountNumber: '0979393916' });
  });
});

describe('CEO điều chỉnh tay', () => {
  it('cần lý do, ghi người thực hiện, không trừ quá số dư', async () => {
    const admin = await createUser();
    const s = await readySeller(100_000);
    expect(await adjustBalance(s.kiotId, admin.id, 5_000, ' ')).toEqual({
      ok: false,
      error: 'REASON_REQUIRED',
    });
    expect(await adjustBalance(s.kiotId, admin.id, 0, 'x')).toEqual({ ok: false, error: 'INVALID_AMOUNT' });
    expect(await adjustBalance(s.kiotId, admin.id, -100_001, 'Thu hồi')).toEqual({
      ok: false,
      error: 'WOULD_GO_NEGATIVE',
    });
    expect(await adjustBalance(s.kiotId, admin.id, -30_000, 'Thu hồi đơn lỗi')).toEqual({ ok: true });
    expect(await adjustBalance(s.kiotId, admin.id, 10_000, 'Bù phí ship')).toEqual({ ok: true });
    expect((await getBalance(s.kiotId)).available).toBe(80_000);
    expect(await db.balanceEntry.findFirst({ where: { type: 'adjustment', amount: -30_000 } })).toMatchObject(
      {
        actorId: admin.id,
        note: 'Thu hồi đơn lỗi',
      },
    );
  });
});

describe('chốt chặn ở database', () => {
  it('không thể có 2 yêu cầu đang mở cho cùng Kiot, kể cả khi ghi thẳng vào DB', async () => {
    const s = await readySeller();
    const r = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r.ok) throw new Error();
    const p = await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } });
    const { id: _id, code: _code, createdAt: _c, updatedAt: _u, autoRuleReasons: _a, ...rest } = p;
    await expect(db.payoutRequest.create({ data: { ...rest, code: 'RT999999' } })).rejects.toThrow();
  });

  it('số tiền chuyển phải bằng số tiền rút trừ phí và lớn hơn 0', async () => {
    const s = await readySeller();
    const base = {
      kiotId: s.kiotId,
      requestedById: s.user.id,
      bankBin: '970422',
      accountNumber: '1',
      accountName: 'A',
      status: 'cancelled',
    };
    await expect(
      db.payoutRequest.create({ data: { ...base, code: 'RT900001', amount: 100, fee: 0, netAmount: 200 } }),
    ).rejects.toThrow();
    await expect(
      db.payoutRequest.create({ data: { ...base, code: 'RT900002', amount: 100, fee: 100, netAmount: 0 } }),
    ).rejects.toThrow();
  });

  it('không sửa, không xoá được dòng sổ số dư', async () => {
    const s = await readySeller();
    const entry = await db.balanceEntry.findFirstOrThrow({ where: { kiotId: s.kiotId } });
    await expect(
      db.balanceEntry.update({ where: { id: entry.id }, data: { amount: 9_999_999 } }),
    ).rejects.toThrow();
    await expect(db.balanceEntry.delete({ where: { id: entry.id } })).rejects.toThrow();
  });
});
