import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { removeVideo, restoreVideo } from '@/modules/creator';
import { resolveProductReports } from '@/modules/marketplace';
import { resolvePaymentIssue } from '@/modules/payments';
import { approvePayoutViaPayos, markPayoutPaid, rejectPayout, reviewKyc } from '@/modules/payouts';
// Khiếu nại "trả cho người bán" làm đơn hoàn tất → phải đi qua lớp ghép có đăng ký hook (cộng số dư, đã bán).
import { transition } from '@/server/orders';

type Ok = { ok: boolean };

// Mỗi thao tác của CEO: chụp trạng thái trước → gọi hàm của module sở hữu dữ liệu → chụp sau → ghi đúng
// 1 dòng nhật ký (chỉ khi thao tác thành công). Admin không ghi thẳng vào bảng của module khác.
async function audited<T extends Ok>(
  adminId: string,
  meta: { action: string; targetType: string; targetId: string; reason?: string | null },
  snapshot: () => Promise<unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const before = await snapshot();
  const result = await run();
  if (result.ok) await audit({ adminId, ...meta, before, after: await snapshot() });
  return result;
}

const payoutSnap = (id: string) => () =>
  db.payoutRequest.findUnique({
    where: { id },
    select: {
      status: true,
      mode: true,
      amount: true,
      netAmount: true,
      bankRef: true,
      rejectReason: true,
      payosPayoutId: true,
    },
  });

export const approvePayout = (adminId: string, payoutId: string) =>
  audited(
    adminId,
    { action: 'payout.approve_payos', targetType: 'payout', targetId: payoutId },
    payoutSnap(payoutId),
    () => approvePayoutViaPayos(payoutId, adminId),
  );

export const markPayoutTransferred = (adminId: string, payoutId: string, bankRef: string) =>
  audited(
    adminId,
    { action: 'payout.mark_paid_manual', targetType: 'payout', targetId: payoutId, reason: bankRef },
    payoutSnap(payoutId),
    () => markPayoutPaid(payoutId, adminId, bankRef),
  );

export const rejectPayoutRequest = (adminId: string, payoutId: string, reason: string) =>
  audited(
    adminId,
    { action: 'payout.reject', targetType: 'payout', targetId: payoutId, reason },
    payoutSnap(payoutId),
    () => rejectPayout(payoutId, adminId, reason),
  );

export const reviewKycSubmission = (
  adminId: string,
  kycId: string,
  decision: 'approve' | 'reject',
  reason: string,
) =>
  audited(
    adminId,
    { action: `kyc.${decision}`, targetType: 'kyc', targetId: kycId, reason: reason || null },
    () =>
      db.kycSubmission.findUnique({
        where: { id: kycId },
        select: { status: true, reason: true, fullName: true },
      }),
    () => reviewKyc(kycId, adminId, decision, reason),
  );

const orderSnap = (id: string) => () =>
  db.order.findUnique({
    where: { id },
    select: { status: true, total: true, refundRef: true, refundedAt: true },
  });

export const markOrderRefunded = (adminId: string, orderId: string, refundRef: string) =>
  audited(
    adminId,
    { action: 'order.mark_refunded', targetType: 'order', targetId: orderId, reason: refundRef },
    orderSnap(orderId),
    () => transition(orderId, 'mark_refunded', { userId: adminId, role: 'admin' }, { refundRef }),
  );

export const resolveDispute = (
  adminId: string,
  orderId: string,
  decision: 'refund' | 'release',
  reason: string,
) =>
  audited(
    adminId,
    { action: `dispute.${decision}`, targetType: 'order', targetId: orderId, reason },
    orderSnap(orderId),
    () =>
      transition(
        orderId,
        decision === 'refund' ? 'resolve_refund' : 'resolve_release',
        { userId: adminId, role: 'admin' },
        { reason },
      ),
  );

export const resolveIssue = (adminId: string, issueKey: string, note: string) =>
  audited(
    adminId,
    { action: 'payment_issue.resolve', targetType: 'payment_issue', targetId: issueKey, reason: note },
    () => db.paymentIssueResolution.findUnique({ where: { issueKey } }),
    () => resolvePaymentIssue(issueKey, adminId, note),
  );

export const resolveProductReport = (
  adminId: string,
  productId: string,
  decision: 'remove' | 'dismiss',
  reason: string,
) =>
  audited(
    adminId,
    {
      action: `product_report.${decision}`,
      targetType: 'product',
      targetId: productId,
      reason: reason || null,
    },
    () =>
      db.product.findUnique({
        where: { id: productId },
        select: { hiddenByAdminAt: true, hiddenReason: true },
      }),
    () => resolveProductReports(productId, adminId, decision, reason),
  );

export const resolveVideoReport = (
  adminId: string,
  videoId: string,
  decision: 'remove' | 'restore',
  reason: string,
) =>
  audited(
    adminId,
    { action: `video.${decision}`, targetType: 'video', targetId: videoId, reason: reason || null },
    () => db.video.findUnique({ where: { id: videoId }, select: { status: true, moderationNote: true } }),
    () => (decision === 'remove' ? removeVideo(videoId, adminId, reason) : restoreVideo(videoId)),
  );
