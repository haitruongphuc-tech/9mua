import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import {
  submitFakeReport,
  respondFakeReport,
  fakeReportBannedUntil,
  closeFakeReport,
} from '@/modules/orders';
import { sellerCredit } from '@/modules/payouts';
import { createPaidOrder, createUser } from '../../tests/helpers/factories';
import { confirmFakeReport, rejectFakeReport } from './fake-reports';

const text = 'Hàng nhận được khác hoàn toàn ảnh, tem chống giả bị bóc.';
const setRefund = (value: 'on' | 'off') =>
  db.setting.upsert({
    where: { key: 'feature.fake_report_refund' },
    create: { key: 'feature.fake_report_refund', value },
    update: { value },
  });

describe('tố cáo hàng giả (SPEC-orders.md V5.2)', () => {
  it('kiểm nội dung, chủ Kiot giải trình 1 lần, CEO xác nhận: gỡ sản phẩm, không hoàn tiền khi công tắc tắt', async () => {
    const { buyer, product, seller, order } = await createPaidOrder();
    const admin = await createUser();
    expect(await submitFakeReport(buyer.id, { productId: product.id, reason: 'fake', text: 'ngắn' })).toEqual(
      {
        ok: false,
        error: 'INVALID',
      },
    );
    expect(
      await submitFakeReport(buyer.id, { productId: product.id, reason: 'fake', text, orderId: 'khong-co' }),
    ).toEqual({ ok: false, error: 'ORDER_INVALID' });
    const r = await submitFakeReport(buyer.id, {
      productId: product.id,
      reason: 'fake',
      text,
      orderId: order.id,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.deadlineAt.getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000);
    expect(await submitFakeReport(buyer.id, { productId: product.id, reason: 'fake', text })).toEqual({
      ok: false,
      error: 'DUPLICATE',
    });
    expect(await respondFakeReport(buyer.id, r.reportId, { text: 'Không phải chủ' })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await respondFakeReport(seller.user.id, r.reportId, { text: 'Có hoá đơn nhập hàng' })).toEqual({
      ok: true,
    });

    await setRefund('off');
    expect(await confirmFakeReport(admin.id, r.reportId, '')).toEqual({
      ok: false,
      error: 'REASON_REQUIRED',
    });
    expect(await confirmFakeReport(admin.id, r.reportId, 'Tem giả')).toEqual({ ok: true, refunded: false });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } })).hiddenByAdminAt,
    ).not.toBeNull();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('paid');
    expect(await confirmFakeReport(admin.id, r.reportId, 'Lần hai')).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('công tắc hoàn tiền bật: đơn đã hoàn tất chuyển hoàn tiền và trừ lại đúng số đã cộng cho người bán (1 lần)', async () => {
    const { buyer, product, order } = await createPaidOrder();
    const admin = await createUser();
    await db.order.update({
      where: { id: order.id },
      data: { status: 'completed', deliveredAt: new Date(), completedAt: new Date() },
    });
    const r = await submitFakeReport(buyer.id, {
      productId: product.id,
      reason: 'wrong_origin',
      text,
      orderId: order.id,
    });
    if (!r.ok) throw new Error(r.error);
    await setRefund('on');
    try {
      expect(await confirmFakeReport(admin.id, r.reportId, 'Sai nguồn gốc')).toEqual({
        ok: true,
        refunded: true,
      });
    } finally {
      await setRefund('off');
    }
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('refund_pending');
    const debit = await db.balanceEntry.findMany({ where: { refId: r.reportId } });
    expect(debit).toHaveLength(1);
    expect(debit[0]!.amount).toBe(-sellerCredit(after).credit);
  });

  it('3 lần bị bác trong 90 ngày thì 30 ngày không tố cáo được', async () => {
    const reporter = await createUser();
    const admin = await createUser();
    for (let i = 0; i < 3; i += 1) {
      const { product } = await createPaidOrder();
      const r = await submitFakeReport(reporter.id, { productId: product.id, reason: 'fake', text });
      if (!r.ok) throw new Error(r.error);
      expect(await rejectFakeReport(admin.id, r.reportId, 'Không đủ bằng chứng')).toBe(true);
    }
    expect(await fakeReportBannedUntil(reporter.id)).not.toBeNull();
    const { product } = await createPaidOrder();
    expect(await submitFakeReport(reporter.id, { productId: product.id, reason: 'fake', text })).toEqual({
      ok: false,
      error: 'BANNED',
    });
    expect(await closeFakeReport('khong-co', admin.id, 'rejected', 'x')).toBe(false);
  });
});
