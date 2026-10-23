import { PayOS } from '@payos/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { simulatePaid } from '../../../tests/helpers/payments';
import { cancelPayment, createPayment, getPayment, listMismatches } from './create';
import { fakeGateway } from './gateway';
import { reconcilePending } from './reconcile';
import { clearPaymentHandlers, registerPaymentHandler } from './registry';
import type { PaidIntent } from './types';
import { handleWebhook } from './webhook';

afterEach(() => clearPaymentHandlers());

const input = {
  purpose: 'kiot_fee' as const,
  refId: 'kiot_1',
  amount: 26_000,
  description: 'KIOT1234',
  returnPath: '/kiot-cua-toi',
};

function spyHandler() {
  const handler = vi.fn<(tx: unknown, intent: PaidIntent) => Promise<void>>(async () => {});
  registerPaymentHandler('kiot_fee', handler);
  return handler;
}

describe('createPayment', () => {
  it('tạo intent pending có orderCode, QR, link, hạn 15 phút', async () => {
    setClock(new Date('2026-10-23T03:00:00Z'));
    const p = await createPayment(input);
    expect(p).toMatchObject({
      status: 'pending',
      amount: 26_000,
      description: 'KIOT1234',
      checkoutUrl: expect.stringContaining(`/dev/payos/${p.orderCode}`),
      qrCode: expect.any(String),
      expiresAt: new Date('2026-10-23T03:15:00Z'),
    });
    expect(p.orderCode).toBeGreaterThan(100_000);
  });

  it('bấm thanh toán 2 lần trả cùng một intent; khác số tiền thì tạo mới', async () => {
    const a = await createPayment(input);
    const b = await createPayment(input);
    expect(b.intentId).toBe(a.intentId);
    const c = await createPayment({ ...input, amount: 30_000 });
    expect(c.intentId).not.toBe(a.intentId);
  });

  it('intent cũ đã hết hạn thì tạo intent mới', async () => {
    setClock(new Date('2026-10-23T03:00:00Z'));
    const a = await createPayment(input);
    advanceClock({ minutes: 16 });
    expect((await createPayment(input)).intentId).not.toBe(a.intentId);
  });

  it('từ chối số tiền dưới 2.000đ hoặc không nguyên', async () => {
    await expect(createPayment({ ...input, amount: 1999 })).rejects.toThrow();
    await expect(createPayment({ ...input, amount: 2000.5 })).rejects.toThrow();
  });
});

describe('webhook', () => {
  it('hợp lệ: intent thành paid, handler chạy đúng 1 lần với intent đã trả', async () => {
    const handler = spyHandler();
    const p = await createPayment(input);
    const { result } = await simulatePaid(p.orderCode);
    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![1]).toMatchObject({
      intentId: p.intentId,
      refId: 'kiot_1',
      amount: 26_000,
    });
    expect(await getPayment(p.intentId)).toMatchObject({ status: 'paid', amountPaid: 26_000 });
  });

  it('cùng webhook gửi 5 lần song song: handler vẫn chạy đúng 1 lần', async () => {
    const handler = spyHandler();
    const p = await createPayment(input);
    const body = await fakeGateway().buildPaidWebhook({
      orderCode: p.orderCode,
      amount: 26_000,
      description: 'KIOT1234',
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => handleWebhook(structuredClone(body))));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await db.paymentEvent.count()).toBe(1);
  });

  it('sai chữ ký: 400 và DB không đổi', async () => {
    const handler = spyHandler();
    const p = await createPayment(input);
    const body = await fakeGateway().buildPaidWebhook({
      orderCode: p.orderCode,
      amount: 26_000,
      description: 'KIOT1234',
    });
    const forged = { ...body, data: { ...body.data, amount: 1_000_000 } };
    expect((await handleWebhook(forged)).status).toBe(400);
    expect((await handleWebhook({ ...body, signature: '0'.repeat(64) })).status).toBe(400);
    expect((await handleWebhook({ nonsense: true })).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    expect(await db.paymentEvent.count()).toBe(0);
    expect((await getPayment(p.intentId))?.status).toBe('pending');
  });

  it('trả thiếu hoặc thừa: mismatch, không gọi handler, admin thấy', async () => {
    const handler = spyHandler();
    const p = await createPayment(input);
    await simulatePaid(p.orderCode, 20_000);
    expect(handler).not.toHaveBeenCalled();
    expect(await getPayment(p.intentId)).toMatchObject({ status: 'mismatch', amountPaid: 20_000 });
    expect((await listMismatches()).map((m) => m.intentId)).toContain(p.intentId);
  });

  it('handler lỗi: rollback, trả 500, intent vẫn pending; gửi lại thì thành công', async () => {
    let fail = true;
    const handler = vi.fn(async () => {
      if (fail) throw new Error('billing lỗi tạm thời');
    });
    registerPaymentHandler('kiot_fee', handler);
    const p = await createPayment(input);
    const body = await fakeGateway().buildPaidWebhook({
      orderCode: p.orderCode,
      amount: 26_000,
      description: 'KIOT1234',
    });
    expect((await handleWebhook(body)).status).toBe(500);
    expect((await getPayment(p.intentId))?.status).toBe('pending');
    expect(await db.paymentEvent.count()).toBe(0);
    fail = false;
    expect((await handleWebhook(body)).status).toBe(200);
    expect((await getPayment(p.intentId))?.status).toBe('paid');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('orderCode không có trong hệ thống: 200 và lưu sự kiện mồ côi để đối soát', async () => {
    const body = await fakeGateway().buildPaidWebhook({
      orderCode: 999_999_999,
      amount: 5000,
      description: 'LA',
    });
    expect((await handleWebhook(body)).status).toBe(200);
    expect(await db.paymentEvent.findFirstOrThrow()).toMatchObject({ outcome: 'orphan' });
  });

  it('trả muộn sau khi intent hết hạn vẫn ghi nhận và gọi handler', async () => {
    const handler = spyHandler();
    setClock(new Date('2026-10-23T03:00:00Z'));
    const p = await createPayment(input);
    advanceClock({ minutes: 40 });
    await reconcilePending();
    expect((await getPayment(p.intentId))?.status).toBe('expired');
    await simulatePaid(p.orderCode);
    expect((await getPayment(p.intentId))?.status).toBe('paid');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('không có handler cho mục đích thanh toán: 500 để PayOS gửi lại, không mất tiền', async () => {
    const p = await createPayment(input);
    expect((await simulatePaid(p.orderCode)).result.status).toBe(500);
    expect((await getPayment(p.intentId))?.status).toBe('pending');
  });
});

describe('đối soát', () => {
  it('PayOS báo PAID mà chưa có webhook: kết quả giống hệt webhook; webhook đến sau không tính lại', async () => {
    const handler = spyHandler();
    const p = await createPayment(input);
    const body = await fakeGateway().markPaidWithoutWebhook({ orderCode: p.orderCode, amount: 26_000 });
    await reconcilePending();
    expect((await getPayment(p.intentId))?.status).toBe('paid');
    expect(handler).toHaveBeenCalledTimes(1);
    expect((await handleWebhook(body)).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('getPayment tự đối soát khi còn pending (trang QR hỏi trạng thái)', async () => {
    spyHandler();
    const p = await createPayment(input);
    await fakeGateway().markPaidWithoutWebhook({ orderCode: p.orderCode, amount: 26_000 });
    expect((await getPayment(p.intentId, { reconcile: true }))?.status).toBe('paid');
  });

  it('huỷ thanh toán', async () => {
    const p = await createPayment(input);
    await cancelPayment(p.intentId, 'Người mua huỷ');
    expect((await getPayment(p.intentId))?.status).toBe('cancelled');
  });
});

describe('hợp đồng với SDK PayOS thật', () => {
  it('webhooks.verify của @payos/node chấp nhận payload do bộ giả lập ký', async () => {
    const p = await createPayment(input);
    const body = await fakeGateway().buildPaidWebhook({
      orderCode: p.orderCode,
      amount: 26_000,
      description: 'KIOT1234',
    });
    const sdk = new PayOS({
      clientId: 'x',
      apiKey: 'y',
      checksumKey: process.env.PAYOS_CHECKSUM_KEY ?? 'fake-checksum-key-9mua',
      logLevel: 'off',
    });
    await expect(sdk.webhooks.verify(body)).resolves.toMatchObject({
      orderCode: p.orderCode,
      amount: 26_000,
    });
  });
});
