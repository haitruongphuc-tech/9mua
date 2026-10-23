import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { processImage, type ImageError } from '@/lib/media/process-image';
import { findBank, normalizeAccountName } from '@/modules/kiot';
import { applyAction, InvalidTransition } from './transition-core';

export const DISPUTE_WINDOW_DAYS = 7;
const MAX_DISPUTE_IMAGES = 3;

const BUYER_INCLUDE = {
  items: true,
  events: { orderBy: { createdAt: 'asc' } },
  dispute: true,
  kiot: { select: { name: true, slug: true, contactPhone: true } },
} as const;

export function listOrdersForBuyer(userId: string) {
  return db.order.findMany({
    where: { buyerId: userId },
    include: BUYER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export function getOrderForBuyer(userId: string, orderId: string) {
  return db.order.findFirst({ where: { id: orderId, buyerId: userId }, include: BUYER_INCLUDE });
}

// Ảnh khiếu nại lưu trong thư mục riêng của người mua để không ai gắn được ảnh của người khác.
export async function uploadDisputeImage(
  userId: string,
  data: Buffer,
): Promise<{ ok: true; url: string } | { ok: false; error: ImageError }> {
  const processed = await processImage(data);
  if (!processed.ok) return processed;
  const url = await imageStore().save(
    `disputes/${userId}/${randomBytes(12).toString('base64url')}.webp`,
    processed.main,
  );
  return { ok: true, url };
}

export async function submitDispute(
  userId: string,
  orderId: string,
  input: { message: string; images: string[] },
): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        'NOT_FOUND' | 'MESSAGE_REQUIRED' | 'INVALID_IMAGES' | 'DISPUTE_WINDOW_CLOSED' | 'INVALID_TRANSITION';
    }
> {
  const order = await db.order.findFirst({ where: { id: orderId, buyerId: userId } });
  if (!order) return { ok: false, error: 'NOT_FOUND' };
  const message = input.message.trim();
  if (message.length < 10 || message.length > 2000) return { ok: false, error: 'MESSAGE_REQUIRED' };
  const prefix = `/uploads/disputes/${userId}/`;
  const images = [...new Set(input.images)];
  if (
    images.length > MAX_DISPUTE_IMAGES ||
    images.length !== input.images.length ||
    images.some((u) => !u.startsWith(prefix) || u.includes('..'))
  ) {
    return { ok: false, error: 'INVALID_IMAGES' };
  }
  if (
    order.status === 'delivered' &&
    order.deliveredAt &&
    now().getTime() - order.deliveredAt.getTime() > DISPUTE_WINDOW_DAYS * 86_400_000
  ) {
    return { ok: false, error: 'DISPUTE_WINDOW_CLOSED' };
  }
  try {
    await db.$transaction(async (tx) => {
      await applyAction(tx, orderId, 'dispute', { id: userId, role: 'buyer' }, { reason: message });
      await tx.dispute.create({ data: { orderId, message, images, createdAt: now() } });
    });
  } catch (error) {
    if (error instanceof InvalidTransition) return { ok: false, error: 'INVALID_TRANSITION' };
    throw error;
  }
  await alertCeo(
    'dispute_new',
    `Đơn ${order.code} (${order.total.toLocaleString('vi-VN')}đ) có khiếu nại mới: “${message.slice(0, 120)}”`,
  );
  return { ok: true };
}

const refundInput = z.object({
  bankBin: z.string().refine((b) => Boolean(findBank(b)), 'Chọn ngân hàng'),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(/^\d{6,19}$/, 'Số tài khoản gồm 6–19 chữ số')),
  accountName: z.string().transform(normalizeAccountName).pipe(z.string().min(3, 'Nhập tên chủ tài khoản')),
});

export async function setRefundAccount(
  userId: string,
  orderId: string,
  raw: { bankBin: string; accountNumber: string; accountName: string },
): Promise<
  | { ok: true }
  | { ok: false; error: 'NOT_FOUND' | 'NOT_REFUNDABLE' }
  | { ok: false; error: 'INVALID_INPUT'; message: string }
> {
  const order = await db.order.findFirst({ where: { id: orderId, buyerId: userId } });
  if (!order) return { ok: false, error: 'NOT_FOUND' };
  if (order.status !== 'refund_pending' && order.status !== 'disputed')
    return { ok: false, error: 'NOT_REFUNDABLE' };
  const parsed = refundInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
  await db.order.update({ where: { id: orderId }, data: { refundAccount: parsed.data } });
  return { ok: true };
}

// Cho admin (T33): đơn chờ hoàn tiền và khiếu nại đang mở.
export function listRefundsPending() {
  return db.order.findMany({
    where: { status: 'refund_pending' },
    include: { items: true, kiot: { select: { name: true } } },
    orderBy: { updatedAt: 'asc' },
  });
}

export function listDisputes() {
  return db.order.findMany({
    where: { status: 'disputed' },
    include: {
      items: true,
      dispute: true,
      events: { orderBy: { createdAt: 'asc' } },
      kiot: { select: { name: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });
}
