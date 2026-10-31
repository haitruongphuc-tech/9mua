import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { purgeUserContent } from '@/modules/creator';
import {
  accountsDueForDeletion,
  anonymizeUser,
  confirmAccountDeletion,
  markAccountDeletion,
  type DeleteConfirm,
  type DeleteRequestError,
} from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { getBalance } from '@/modules/payouts';

// Tự xoá tài khoản (SPEC-identity.md V5.3): lớp ghép ở tầng ứng dụng vì điều kiện đọc nhiều module (Kiot, đơn hàng,
// rút tiền), còn ẩn danh hoá cần creator gỡ nội dung trước.
export type DeleteBlocker = 'KIOT_BALANCE' | 'OPEN_ORDERS' | 'PAYOUT_PENDING';

const DONE = ['completed', 'cancelled', 'refunded'] as const;

export async function deletionBlockers(userId: string): Promise<DeleteBlocker[]> {
  const out: DeleteBlocker[] = [];
  const kiot = await getKiotByOwner(userId);
  if (kiot) {
    const b = await getBalance(kiot.id);
    if (b.available > 0 || b.pending > 0) out.push('KIOT_BALANCE');
  }
  // Đơn mua hoặc đơn bán chưa xong (kể cả đang khiếu nại).
  const open = await db.order.count({
    where: {
      status: { notIn: [...DONE] },
      OR: [{ buyerId: userId }, ...(kiot ? [{ kiotId: kiot.id }] : [])],
    },
  });
  if (open > 0) out.push('OPEN_ORDERS');
  if (
    kiot &&
    (await db.payoutRequest.count({ where: { kiotId: kiot.id, status: { in: ['pending', 'processing'] } } }))
  )
    out.push('PAYOUT_PENDING');
  return out;
}

export async function requestAccountDeletion(
  userId: string,
  confirm: DeleteConfirm,
): Promise<
  | { ok: true }
  | { ok: false; error: DeleteRequestError }
  | { ok: false; error: 'BLOCKED'; blockers: DeleteBlocker[] }
> {
  const blockers = await deletionBlockers(userId);
  if (blockers.length) return { ok: false, error: 'BLOCKED', blockers };
  const c = await confirmAccountDeletion(userId, confirm);
  if (!c.ok) return c;
  await markAccountDeletion(userId);
  return { ok: true };
}

// Việc hằng ngày: tài khoản đã quá 30 ngày chờ → gỡ nội dung, xoá ảnh, ẩn danh hoá. Sổ tiền, đơn hàng, nhật ký CEO giữ
// nguyên (chỉ thêm). Lúc này mà lại có đơn chưa xong thì hoãn sang ngày sau.
export async function finalizeAccountDeletions(): Promise<number> {
  let n = 0;
  for (const userId of await accountsDueForDeletion()) {
    if ((await deletionBlockers(userId)).length) continue;
    await purgeUserContent(userId);
    const images = await anonymizeUser(userId);
    for (const url of [images.avatarUrl, images.coverUrl])
      if (url)
        await imageStore()
          .remove(url)
          .catch(() => {});
    n += 1;
  }
  return n;
}
