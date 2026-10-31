import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processImage } from '@/lib/media/process-image';
import { notifyKey } from '@/lib/notifications';

// Tố cáo hàng giả, xử lý 24 giờ (SPEC-orders.md V5.2, công tắc fake_report). Phần gỡ hàng, thu hồi huy hiệu, hoàn tiền
// khi CEO xác nhận nằm ở tầng ứng dụng (src/server/fake-reports.ts) vì đụng nhiều module.
export const FAKE_REASONS = ['fake', 'wrong_origin'] as const;
export type FakeReason = (typeof FAKE_REASONS)[number];
export const FAKE_DEADLINE_HOURS = 24;
export const SELLER_RESPONSE_HOURS = 12;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type FakeReportError =
  'NOT_FOUND' | 'INVALID' | 'HAS_LINK' | 'BANNED' | 'ORDER_INVALID' | 'IMAGE_INVALID' | 'DUPLICATE' | 'LATE';

// Tố cáo sai nhiều lần: 3 lần bị bác trong 90 ngày thì 30 ngày không tố cáo được.
export async function fakeReportBannedUntil(userId: string): Promise<Date | null> {
  const t = now();
  const rejected = await db.fakeReport.findMany({
    where: { reporterId: userId, status: 'rejected', resolvedAt: { gte: new Date(t.getTime() - 90 * DAY) } },
    orderBy: { resolvedAt: 'desc' },
    select: { resolvedAt: true },
    take: 3,
  });
  if (rejected.length < 3 || !rejected[0]?.resolvedAt) return null;
  const until = new Date(rejected[0].resolvedAt.getTime() + 30 * DAY);
  return until > t ? until : null;
}

export async function submitFakeReport(
  userId: string,
  input: { productId: string; reason: string; text: string; images?: Buffer[]; orderId?: string | null },
): Promise<{ ok: true; reportId: string; deadlineAt: Date } | { ok: false; error: FakeReportError }> {
  if (!FAKE_REASONS.includes(input.reason as FakeReason)) return { ok: false, error: 'INVALID' };
  const text = input.text.replace(/\r\n/g, '\n').trim();
  if (text.length < 20 || text.length > 2000) return { ok: false, error: 'INVALID' };
  if (hasLink(text)) return { ok: false, error: 'HAS_LINK' };
  if ((input.images?.length ?? 0) > 5) return { ok: false, error: 'INVALID' };
  if (await fakeReportBannedUntil(userId)) return { ok: false, error: 'BANNED' };
  const product = await db.product.findFirst({
    where: { id: input.productId, deletedAt: null },
    select: { id: true, kiotId: true },
  });
  if (!product) return { ok: false, error: 'NOT_FOUND' };
  if (
    await db.fakeReport.findFirst({
      where: { reporterId: userId, productId: product.id, status: { in: ['open', 'investigating'] } },
    })
  )
    return { ok: false, error: 'DUPLICATE' };
  let orderId: string | null = null;
  if (input.orderId) {
    const order = await db.order.findFirst({
      where: { id: input.orderId, buyerId: userId, items: { some: { productId: product.id } } },
      select: { id: true },
    });
    if (!order) return { ok: false, error: 'ORDER_INVALID' };
    orderId = order.id;
  }
  const images: string[] = [];
  for (const data of input.images ?? []) {
    if (data.length > 10 * 1024 * 1024) return { ok: false, error: 'IMAGE_INVALID' };
    const p = await processImage(data);
    if (!p.ok) return { ok: false, error: 'IMAGE_INVALID' };
    images.push(
      await imageStore().save(
        `fake-reports/${userId.slice(-6)}-${randomBytes(8).toString('hex')}.webp`,
        p.main,
      ),
    );
  }
  const t = now();
  const report = await db.fakeReport.create({
    data: {
      reporterId: userId,
      productId: product.id,
      kiotId: product.kiotId,
      orderId,
      reason: input.reason,
      text,
      images,
      deadlineAt: new Date(t.getTime() + FAKE_DEADLINE_HOURS * HOUR),
      createdAt: t,
    },
  });
  const kiot = await db.kiot.findUniqueOrThrow({ where: { id: product.kiotId }, select: { ownerId: true } });
  await notifyKey(
    kiot.ownerId,
    'notify.fakeReportSeller',
    { hours: SELLER_RESPONSE_HOURS },
    '/kiot-cua-toi/to-cao',
  );
  return { ok: true, reportId: report.id, deadlineAt: report.deadlineAt };
}

// Chủ Kiot gửi giải trình kèm giấy tờ trong 12 giờ.
export async function respondFakeReport(
  ownerId: string,
  reportId: string,
  input: { text: string; images?: Buffer[] },
): Promise<{ ok: true } | { ok: false; error: FakeReportError }> {
  const r = await db.fakeReport.findUnique({ where: { id: reportId } });
  const kiot = r ? await db.kiot.findUnique({ where: { id: r.kiotId }, select: { ownerId: true } }) : null;
  if (!r || kiot?.ownerId !== ownerId || !['open', 'investigating'].includes(r.status))
    return { ok: false, error: 'NOT_FOUND' };
  if (r.sellerResponse !== null) return { ok: false, error: 'DUPLICATE' };
  if (now().getTime() > r.createdAt.getTime() + SELLER_RESPONSE_HOURS * HOUR)
    return { ok: false, error: 'LATE' };
  const text = input.text.trim();
  if (!text || text.length > 2000) return { ok: false, error: 'INVALID' };
  const images: string[] = [];
  for (const data of (input.images ?? []).slice(0, 5)) {
    const p = await processImage(data);
    if (!p.ok) return { ok: false, error: 'IMAGE_INVALID' };
    images.push(await imageStore().save(`fake-reports/kiot-${randomBytes(8).toString('hex')}.webp`, p.main));
  }
  await db.fakeReport.update({
    where: { id: reportId },
    data: { sellerResponse: text, sellerImages: images, sellerRespondedAt: now(), status: 'investigating' },
  });
  return { ok: true };
}

export async function fakeReportsForKiot(ownerId: string) {
  const kiot = await db.kiot.findUnique({ where: { ownerId }, select: { id: true } });
  if (!kiot) return [];
  return db.fakeReport.findMany({
    where: { kiotId: kiot.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      productId: true,
      reason: true,
      text: true,
      images: true,
      status: true,
      sellerResponse: true,
      createdAt: true,
      deadlineAt: true,
      resolution: true,
    },
  });
}

export async function myFakeReports(userId: string) {
  return db.fakeReport.findMany({
    where: { reporterId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, productId: true, status: true, deadlineAt: true, resolution: true, createdAt: true },
  });
}

// Hàng chờ CEO /admin/hang-gia: xếp theo hạn; quá hạn hiện đỏ.
export async function listFakeReportQueue() {
  const rows = await db.fakeReport.findMany({
    where: { status: { in: ['open', 'investigating'] } },
    orderBy: { deadlineAt: 'asc' },
    take: 200,
  });
  const products = await db.product.findMany({
    where: { id: { in: rows.map((r) => r.productId) } },
    select: { id: true, name: true, kiot: { select: { name: true, slug: true } } },
  });
  return rows.map((r) => ({
    ...r,
    product: products.find((p) => p.id === r.productId) ?? null,
    overdue: r.deadlineAt < now(),
  }));
}

export async function getFakeReport(reportId: string) {
  return db.fakeReport.findUnique({ where: { id: reportId } });
}

// Chốt kết quả (gọi từ tầng ứng dụng). Chỉ đổi một lần: open/investigating → confirmed | rejected.
export async function closeFakeReport(
  reportId: string,
  adminId: string,
  decision: 'confirmed' | 'rejected',
  resolution: string,
): Promise<boolean> {
  const r = await db.fakeReport.updateMany({
    where: { id: reportId, status: { in: ['open', 'investigating'] } },
    data: { status: decision, resolution: resolution.slice(0, 500), resolvedBy: adminId, resolvedAt: now() },
  });
  if (!r.count) return false;
  const report = await db.fakeReport.findUniqueOrThrow({ where: { id: reportId } });
  await notifyKey(
    report.reporterId,
    decision === 'confirmed' ? 'notify.fakeReportConfirmed' : 'notify.fakeReportRejected',
    { reason: resolution.slice(0, 120) },
    '/to-cao-hang-gia',
  );
  return true;
}

// Số tố cáo quá hạn chưa xử lý (cảnh báo trên trang tổng quan CEO).
export async function overdueFakeReports(): Promise<number> {
  return db.fakeReport.count({
    where: { status: { in: ['open', 'investigating'] }, deadlineAt: { lt: now() } },
  });
}

// Đơn gắn với tố cáo (tầng ứng dụng dùng để hoàn tiền): đủ số để tính tiền đã cộng cho người bán.
export async function fakeReportOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      buyerId: true,
      kiotId: true,
      status: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      platformFeeRate: true,
    },
  });
}

// Đơn của tôi có sản phẩm này (để gắn với tố cáo).
export async function ordersWithProduct(userId: string, productId: string) {
  return db.order.findMany({
    where: { buyerId: userId, items: { some: { productId } }, status: { not: 'pending_payment' } },
    select: { id: true, code: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
