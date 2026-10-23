import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { setSetting } from '@/lib/settings';
import { lockKiot, setPayoutAccount } from '@/modules/kiot';
import { fakePayoutClient } from '@/modules/payments';
import { createPaidOrder, createSeller, createUser } from '../../../tests/helpers/factories';
import { evaluateAutoRules } from './auto-rules';
import { approvePayoutViaPayos } from './dispatch';
import { getBalance } from './ledger';
import { cancelPayout, markPayoutPaid, requestPayout } from './request';
import { checkPayoutFund, syncProcessingPayouts } from './sync';

let codeSeq = 0;

// Người bán đủ MỌI luật chi tự động: CCCD khớp tên tài khoản, tài khoản ổn định > 72 giờ,
// đã có 1 lần rút được CEO duyệt tay, số dư sẵn.
async function trustedSeller(opts: { balance?: number; kycName?: string; priorManual?: boolean } = {}) {
  setClock(new Date('2026-10-20T02:00:00Z'));
  const s = await createSeller({ active: true });
  await db.user.update({ where: { id: s.user.id }, data: { email: `ban${s.kiotId}@9mua.test` } });
  await setPayoutAccount(s.user.id, {
    bankBin: '970422',
    accountNumber: '0979393916',
    accountName: 'NGUYEN HAI',
    password: s.user.password,
  });
  await db.kycSubmission.create({
    data: {
      userId: s.user.id,
      fullName: opts.kycName ?? 'NGUYEN HAI',
      idNumber: '079123456789',
      frontImage: 'x',
      backImage: 'y',
      status: 'approved',
    },
  });
  await db.balanceEntry.create({
    data: {
      kiotId: s.kiotId,
      type: 'order_credit',
      amount: opts.balance ?? 1_000_000,
      refId: `seed-${s.kiotId}`,
    },
  });
  if (opts.priorManual !== false) {
    codeSeq += 1;
    await db.payoutRequest.create({
      data: {
        code: `RT0${codeSeq}`,
        kiotId: s.kiotId,
        requestedById: s.user.id,
        amount: 60_000,
        fee: 0,
        netAmount: 60_000,
        bankBin: '970422',
        accountNumber: '0979393916',
        accountName: 'NGUYEN HAI',
        status: 'paid',
        mode: 'manual',
        paidAt: new Date('2026-10-20T03:00:00Z'),
      },
    });
  }
  advanceClock({ days: 4 });
  return s;
}

async function makeAdmin() {
  const a = await createUser();
  await db.user.update({ where: { id: a.id }, data: { role: 'admin', email: 'ceo@9mua.test' } });
  return a;
}

const ceoMails = () => getOutbox().filter((m) => m.to === 'ceo@9mua.test');

async function expectQueuedWith(
  s: Awaited<ReturnType<typeof trustedSeller>>,
  amount: number,
  reasons: string[],
) {
  const r = await requestPayout(s.kiotId, s.user.id, amount);
  expect(r).toMatchObject({ ok: true, mode: 'manual', reasons });
  if (!r.ok) throw new Error();
  expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
    status: 'pending',
    mode: 'manual',
    autoRuleReasons: reasons,
  });
  return r;
}

describe('luật chi tự động: đủ điều kiện', () => {
  it('chi ngay qua PayOS, đồng bộ SUCCEEDED thì thành paid và báo người bán', async () => {
    const s = await trustedSeller();
    await setSetting('payout_fee_vnd', '2000', null);
    const r = await requestPayout(s.kiotId, s.user.id, 300_000);
    expect(r).toMatchObject({ ok: true, mode: 'auto', reasons: [] });
    if (!r.ok) throw new Error();
    const fake = fakePayoutClient();
    expect([...fake.records.values()].map((x) => x.input)).toEqual([
      {
        referenceId: r.code,
        amount: 298_000,
        description: `9MUA RUT ${r.code}`,
        toBin: '970422',
        toAccountNumber: '0979393916',
      },
    ]);
    expect([...fake.records.values()][0]!.key).toBe(r.payoutId);
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'processing',
      mode: 'auto',
    });

    expect(await syncProcessingPayouts()).toMatchObject({ checked: 1, paid: 1 });
    const paid = await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } });
    expect(paid).toMatchObject({
      status: 'paid',
      payosState: 'SUCCEEDED',
      receiverNameFromBank: 'NGUOI NHAN THAT',
    });
    expect(paid.bankRef).toMatch(/^FT/);
    expect((await getBalance(s.kiotId)).available).toBe(700_000);
    expect(getOutbox().some((m) => m.subject === `Đã chuyển 298.000đ cho yêu cầu rút ${r.code}`)).toBe(true);
    // Đồng bộ lại không đổi gì.
    expect(await syncProcessingPayouts()).toMatchObject({ checked: 0 });
  });
});

describe('luật chi tự động: sai đúng 1 điều kiện thì vào hàng chờ với lý do đúng', () => {
  it('CEO tắt công tắc', async () => {
    const s = await trustedSeller();
    await setSetting('payout_auto_enabled', 'false', null);
    await expectQueuedWith(s, 100_000, ['CEO đang tắt chi tự động']);
    expect(fakePayoutClient().records.size).toBe(0);
  });

  it('tên tài khoản khác tên CCCD', async () => {
    const s = await trustedSeller({ kycName: 'NGUYEN VAN HAI' });
    await expectQueuedWith(s, 100_000, ['Tên tài khoản ngân hàng khác tên trên CCCD']);
  });

  it('tài khoản đổi chưa đủ 72 giờ', async () => {
    const s = await trustedSeller();
    await setPayoutAccount(s.user.id, {
      bankBin: '970436',
      accountNumber: '1234567890',
      accountName: 'NGUYEN HAI',
      password: s.user.password,
    });
    advanceClock({ hours: 30 });
    await expectQueuedWith(s, 100_000, ['Tài khoản đổi 30 giờ trước']);
  });

  it('lần rút đầu luôn duyệt tay', async () => {
    const s = await trustedSeller({ priorManual: false });
    await expectQueuedWith(s, 100_000, ['Lần rút đầu']);
  });

  it('vượt hạn mức mỗi lần', async () => {
    const s = await trustedSeller({ balance: 6_000_000 });
    await expectQueuedWith(s, 5_000_001, ['Vượt 5.000.000đ']);
  });

  it('vượt hạn mức ngày của Kiot', async () => {
    const s = await trustedSeller();
    await setSetting('payout_auto_max_per_kiot_day', '150000', null);
    const first = await requestPayout(s.kiotId, s.user.id, 100_000);
    expect(first).toMatchObject({ mode: 'auto' });
    await syncProcessingPayouts();
    await expectQueuedWith(s, 100_000, ['Vượt hạn mức 150.000đ/ngày của Kiot']);
  });

  it('vượt hạn mức ngày toàn sàn: các yêu cầu sau vào hàng chờ; sang ngày mới thì lại tự động', async () => {
    const a = await trustedSeller();
    const b = await trustedSeller();
    await setSetting('payout_auto_daily_cap', '150000', null);
    expect(await requestPayout(a.kiotId, a.user.id, 100_000)).toMatchObject({ mode: 'auto' });
    const queued = await expectQueuedWith(b, 100_000, ['Vượt hạn mức 150.000đ/ngày toàn sàn']);
    await cancelPayout(queued.payoutId, b.user.id);
    advanceClock({ days: 1 });
    expect(await requestPayout(b.kiotId, b.user.id, 100_000)).toMatchObject({ mode: 'auto' });
  });

  it('Kiot bị khoá', async () => {
    const s = await trustedSeller();
    await lockKiot(s.kiotId, 'Nghi gian lận');
    await expectQueuedWith(s, 100_000, ['Kiot đang bị khoá']);
  });

  it('Kiot có đơn đang khiếu nại', async () => {
    const s = await trustedSeller();
    const { order } = await createPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { kiotId: s.kiotId, status: 'disputed' } });
    await expectQueuedWith(s, 100_000, ['Kiot có đơn đang khiếu nại']);
  });

  it('quỹ chi PayOS không đủ', async () => {
    const s = await trustedSeller();
    fakePayoutClient().fund = 50_000;
    await expectQueuedWith(s, 100_000, ['Quỹ chi PayOS không đủ']);
  });

  it('không đọc được quỹ chi PayOS', async () => {
    const s = await trustedSeller();
    fakePayoutClient().failBalance = true;
    await expectQueuedWith(s, 100_000, ['Không kiểm được quỹ chi PayOS']);
  });

  it('nhiều điều kiện sai thì liệt kê đủ', async () => {
    const s = await trustedSeller({ priorManual: false, balance: 6_000_000 });
    await setSetting('payout_auto_enabled', 'false', null);
    const r = await requestPayout(s.kiotId, s.user.id, 5_500_000);
    if (!r.ok) throw new Error();
    expect((await evaluateAutoRules(r.payoutId)).reasons).toEqual([
      'CEO đang tắt chi tự động',
      'Lần rút đầu',
      'Vượt 5.000.000đ',
    ]);
  });
});

describe('PayOS lỗi', () => {
  it('PayOS báo FAILED: hoàn đủ số dư, báo người bán và CEO', async () => {
    await makeAdmin();
    const s = await trustedSeller();
    fakePayoutClient().outcome = 'FAILED';
    const r = await requestPayout(s.kiotId, s.user.id, 400_000);
    if (!r.ok) throw new Error();
    expect((await getBalance(s.kiotId)).available).toBe(600_000);
    expect(await syncProcessingPayouts()).toMatchObject({ failed: 1 });
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'failed',
      payosState: 'FAILED',
      rejectReason: 'Tài khoản nhận không tồn tại',
    });
    expect((await getBalance(s.kiotId)).available).toBe(1_000_000);
    expect(ceoMails().map((m) => m.subject)).toEqual(['[9MUA] Lệnh chi PayOS lỗi']);
    expect(getOutbox().some((m) => m.subject === `Chuyển tiền cho yêu cầu rút ${r.code} bị lỗi`)).toBe(true);
    // Đồng bộ chạy lại không hoàn tiền lần 2.
    await syncProcessingPayouts();
    expect((await getBalance(s.kiotId)).available).toBe(1_000_000);
  });

  it('lần gọi đầu mất phản hồi (PayOS đã tạo lệnh): đồng bộ tìm lại đúng lệnh, chỉ có 1 lệnh chi', async () => {
    const s = await trustedSeller();
    const fake = fakePayoutClient();
    fake.nextCreate = 'lost-response';
    const r = await requestPayout(s.kiotId, s.user.id, 200_000);
    expect(r).toMatchObject({ mode: 'auto' });
    if (!r.ok) throw new Error();
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'processing',
      payosState: 'UNKNOWN',
      payosPayoutId: null,
    });
    await syncProcessingPayouts(); // tìm lại lệnh theo mã RT, lưu payosPayoutId
    expect((await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).payosPayoutId).toBe(
      [...fake.records.keys()][0],
    );
    await syncProcessingPayouts(); // nhận SUCCEEDED
    expect(fake.records.size).toBe(1);
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'paid',
    });
  });

  it('PayOS không phản hồi (chưa tạo lệnh): đồng bộ gửi lại cùng idempotencyKey', async () => {
    const s = await trustedSeller();
    const fake = fakePayoutClient();
    fake.nextCreate = 'down';
    const r = await requestPayout(s.kiotId, s.user.id, 200_000);
    if (!r.ok) throw new Error();
    expect(fake.records.size).toBe(0);
    await syncProcessingPayouts(); // gửi lại
    await syncProcessingPayouts(); // nhận SUCCEEDED
    expect(fake.records.size).toBe(1);
    expect([...fake.records.values()][0]!.key).toBe(r.payoutId);
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'paid',
    });
  });

  it('PayOS từ chối lệnh: về hàng chờ CEO kèm lý do; CEO bấm "Chi qua PayOS" lại thì dùng khoá mới', async () => {
    const admin = await makeAdmin();
    const s = await trustedSeller();
    const fake = fakePayoutClient();
    fake.nextCreate = { reject: 'Số tài khoản không hợp lệ' };
    const r = await requestPayout(s.kiotId, s.user.id, 200_000);
    if (!r.ok) throw new Error();
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'pending',
      mode: 'manual',
      payosAttempt: 1,
      autoRuleReasons: ['PayOS từ chối: Số tài khoản không hợp lệ'],
    });
    expect((await getBalance(s.kiotId)).available).toBe(800_000); // tiền vẫn giữ trong yêu cầu
    expect(ceoMails().map((m) => m.subject)).toEqual(['[9MUA] PayOS từ chối lệnh chi']);

    expect(await approvePayoutViaPayos(r.payoutId, admin.id)).toEqual({ ok: true, status: 'processing' });
    expect([...fake.records.values()][0]!.key).toBe(`${r.payoutId}-r1`);
    await syncProcessingPayouts();
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: r.payoutId } })).toMatchObject({
      status: 'paid',
      mode: 'manual',
      processedById: admin.id,
    });
  });

  it('lệnh treo (ON_HOLD) hoặc quá 2 giờ: báo CEO một lần', async () => {
    await makeAdmin();
    const s = await trustedSeller();
    fakePayoutClient().outcome = 'ON_HOLD';
    await requestPayout(s.kiotId, s.user.id, 200_000);
    await syncProcessingPayouts();
    advanceClock({ hours: 3 });
    await syncProcessingPayouts();
    expect(ceoMails().map((m) => m.subject)).toEqual(['[9MUA] Lệnh chi PayOS bị treo']);
  });

  it('đang chuyển thì người bán không huỷ được, CEO không đánh dấu chuyển tay được', async () => {
    const admin = await makeAdmin();
    const s = await trustedSeller();
    fakePayoutClient().outcome = 'PROCESSING';
    const r = await requestPayout(s.kiotId, s.user.id, 200_000);
    if (!r.ok) throw new Error();
    expect(await cancelPayout(r.payoutId, s.user.id)).toEqual({ ok: false, error: 'NOT_CANCELLABLE' });
    expect(await markPayoutPaid(r.payoutId, admin.id, 'FT1')).toEqual({ ok: false, error: 'NOT_PENDING' });
  });
});

describe('CEO duyệt "Chi qua PayOS" và luồng hai lần rút', () => {
  it('lần 1 vào hàng chờ, CEO chi qua PayOS → paid; lần 2 được chi tự động', async () => {
    const admin = await makeAdmin();
    const s = await trustedSeller({ priorManual: false });
    const first = await requestPayout(s.kiotId, s.user.id, 100_000);
    expect(first).toMatchObject({ mode: 'manual', reasons: ['Lần rút đầu'] });
    if (!first.ok) throw new Error();
    expect(await approvePayoutViaPayos(first.payoutId, admin.id)).toMatchObject({ ok: true });
    await syncProcessingPayouts();
    expect(await db.payoutRequest.findUniqueOrThrow({ where: { id: first.payoutId } })).toMatchObject({
      status: 'paid',
      mode: 'manual',
    });
    expect(await approvePayoutViaPayos(first.payoutId, admin.id)).toMatchObject({
      ok: false,
      error: 'NOT_PENDING',
    });

    const second = await requestPayout(s.kiotId, s.user.id, 100_000);
    expect(second).toMatchObject({ mode: 'auto' });
    await syncProcessingPayouts();
    expect((await getBalance(s.kiotId)).available).toBe(800_000);
  });

  it('CEO chi qua PayOS khi quỹ chi không đủ thì bị chặn', async () => {
    const admin = await makeAdmin();
    const s = await trustedSeller({ priorManual: false });
    const r = await requestPayout(s.kiotId, s.user.id, 100_000);
    if (!r.ok) throw new Error();
    fakePayoutClient().fund = 1_000;
    expect(await approvePayoutViaPayos(r.payoutId, admin.id)).toMatchObject({ ok: false, error: 'FUND_LOW' });
  });

  it('hai Kiot rút tự động cùng lúc khi hạn mức toàn sàn chỉ đủ 1: đúng 1 lệnh được chi tự động', async () => {
    const a = await trustedSeller();
    const b = await trustedSeller();
    await setSetting('payout_auto_daily_cap', '150000', null);
    const results = await Promise.all([
      requestPayout(a.kiotId, a.user.id, 100_000),
      requestPayout(b.kiotId, b.user.id, 100_000),
    ]);
    expect(results.map((r) => (r.ok ? r.mode : r.error)).sort()).toEqual(['auto', 'manual']);
    expect(fakePayoutClient().records.size).toBe(1);
  });
});

describe('quỹ chi PayOS', () => {
  it('báo CEO khi quỹ thấp hơn tổng yêu cầu đang chờ cộng 10 triệu', async () => {
    await makeAdmin();
    const s = await trustedSeller({ priorManual: false });
    await requestPayout(s.kiotId, s.user.id, 500_000);
    fakePayoutClient().fund = 10_400_000;
    expect(await checkPayoutFund()).toEqual({ fund: 10_400_000, open: 500_000 });
    expect(ceoMails().map((m) => m.subject)).toEqual(['[9MUA] Quỹ chi PayOS sắp hết']);
    expect(ceoMails()[0]!.text).toContain('Nạp thêm ít nhất 100.000đ');
  });
});
