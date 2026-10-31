import { audit } from '@/lib/audit';
import { isFeatureOn } from '@/lib/features';
import { hideProduct, revokeOriginForKiot } from '@/modules/kiot';
import { closeFakeReport, getFakeReport, fakeReportOrder, transition } from '@/modules/orders';
import { debitForFakeRefund } from '@/modules/payouts';

// CEO xử lý tố cáo hàng giả (SPEC-orders.md V5.2 mục 6–7). Ghép nhiều module nên nằm ở tầng ứng dụng; mỗi bước tự chống
// chạy lặp (đóng tố cáo 1 lần, khoá duy nhất BalanceEntry(type, refId), bảng chuyển trạng thái đơn) và ghi nhật ký CEO.
// Ghi vi phạm (SPEC-admin.md V5.3) nối ở T126 khi có sổ Strike.
export async function confirmFakeReport(
  adminId: string,
  reportId: string,
  resolution: string,
): Promise<{ ok: true; refunded: boolean } | { ok: false; error: 'NOT_FOUND' | 'REASON_REQUIRED' }> {
  const reason = resolution.trim();
  if (!reason) return { ok: false, error: 'REASON_REQUIRED' };
  const report = await getFakeReport(reportId);
  if (!report || !(await closeFakeReport(reportId, adminId, 'confirmed', reason)))
    return { ok: false, error: 'NOT_FOUND' };
  const log = (action: string, targetType: string, targetId: string) =>
    audit({ adminId, action, targetType, targetId, reason });
  await log('fake_report.confirm', 'fake_report', reportId);
  await hideProduct(report.productId, `Hàng giả (tố cáo ${reportId}): ${reason}`.slice(0, 300));
  await log('product.hide', 'product', report.productId);
  if (await revokeOriginForKiot(report.kiotId, adminId, `Hàng giả: ${reason}`))
    await log('origin.revoke', 'kiot', report.kiotId);

  // Hoàn tiền (công tắc fake_report_refund, tắt sẵn): chỉ khi tố cáo gắn với đơn của chính người tố cáo.
  if (!report.orderId || !(await isFeatureOn('fake_report_refund'))) return { ok: true, refunded: false };
  const order = await fakeReportOrder(report.orderId);
  if (!order || order.buyerId !== report.reporterId) return { ok: true, refunded: false };
  const wasCompleted = order.status === 'completed';
  const moved = await transition(order.id, 'fake_refund', { role: 'admin', userId: adminId }, { reason });
  if (!moved.ok) return { ok: true, refunded: false };
  await log('order.fake_refund', 'order', order.id);
  // Đơn đã hoàn tất: người bán đã được cộng số dư → trừ lại đúng số đã cộng (số dư có thể âm).
  if (wasCompleted) {
    await debitForFakeRefund(order, adminId, reportId);
    await log('balance.fake_refund', 'kiot', order.kiotId);
  }
  return { ok: true, refunded: true };
}

export async function rejectFakeReport(
  adminId: string,
  reportId: string,
  resolution: string,
): Promise<boolean> {
  const reason = resolution.trim();
  if (!reason || !(await closeFakeReport(reportId, adminId, 'rejected', reason))) return false;
  await audit({
    adminId,
    action: 'fake_report.reject',
    targetType: 'fake_report',
    targetId: reportId,
    reason,
  });
  return true;
}
