import { Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { notifyKey } from '@/lib/notifications';
import { getIntSetting, getSetting } from '@/lib/settings';
import { grantVoucherYear } from '@/modules/billing';
import { getKiotByOwner } from '@/modules/kiot';

// Voucher mở Kiot khi đủ số video đã thả tim (SPEC-social.md mục 8). Mỗi tài khoản tối đa 1 voucher trong đời.
const MIN_ACCOUNT_AGE_MS = 3 * 86_400_000;

// Số video khác nhau đang thích, không tính video của chính mình.
export async function likedVideoCount(userId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "VideoLike" l JOIN "Video" v ON v.id = l."videoId"
    WHERE l."userId" = ${userId} AND v."authorId" <> ${userId}`;
  return rows[0]?.n ?? 0;
}

// Gọi sau mỗi lần thích video. Đủ điều kiện thì tặng voucher và báo trong app.
export async function checkVoucher(userId: string): Promise<boolean> {
  if ((await getSetting('social_voucher_enabled')) !== 'true') return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, lockedAt: true, role: true },
  });
  if (!user || user.lockedAt || user.role === 'admin') return false;
  if (now().getTime() - user.createdAt.getTime() < MIN_ACCOUNT_AGE_MS) return false;
  if (await db.kiotVoucher.count({ where: { userId } })) return false;
  if ((await likedVideoCount(userId)) < (await getIntSetting('social_voucher_threshold'))) return false;
  try {
    await db.kiotVoucher.create({ data: { userId, issuedAt: now() } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false; // đã có
    throw e;
  }
  await notifyKey(userId, 'notify.voucherIssued', {}, '/kiot-cua-toi');
  return true;
}

export type VoucherView = {
  id: string;
  issuedAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  usable: boolean;
};

export async function getVoucher(userId: string): Promise<VoucherView | null> {
  const v = await db.kiotVoucher.findUnique({ where: { userId } });
  return v
    ? {
        id: v.id,
        issuedAt: v.issuedAt,
        usedAt: v.usedAt,
        revokedAt: v.revokedAt,
        usable: !v.usedAt && !v.revokedAt,
      }
    : null;
}

// billing gọi trong transaction kích hoạt Kiot bằng voucher (SPEC-billing.md bổ sung 27/10): chỉ thành công 1 lần.
export async function consumeVoucher(tx: Tx, userId: string, kiotId: string): Promise<boolean> {
  const { count } = await tx.kiotVoucher.updateMany({
    where: { userId, usedAt: null, revokedAt: null },
    data: { usedAt: now(), kiotId },
  });
  return count === 1;
}

class NoVoucher extends Error {}

// Chủ Kiot bấm "Dùng voucher – miễn phí 1 năm": đánh dấu voucher đã dùng và ghi kỳ 1 năm (0đ) trong CÙNG một
// transaction (SPEC-billing.md bổ sung 27/10). Bấm 2 lần cũng chỉ dùng được 1 lần; voucher bị thu hồi thì không dùng được.
export async function redeemVoucher(
  userId: string,
): Promise<{ ok: true; periodEnd: Date } | { ok: false; error: 'NO_KIOT' | 'KIOT_LOCKED' | 'NO_VOUCHER' }> {
  const kiot = await getKiotByOwner(userId);
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  if (kiot.lockedAt) return { ok: false, error: 'KIOT_LOCKED' };
  try {
    const period = await db.$transaction(async (tx) => {
      if (!(await consumeVoucher(tx, userId, kiot.id))) throw new NoVoucher();
      return grantVoucherYear(tx, kiot.id);
    });
    return { ok: true, periodEnd: period.end };
  } catch (e) {
    if (e instanceof NoVoucher) return { ok: false, error: 'NO_VOUCHER' };
    throw e;
  }
}

export async function revokeVoucher(
  voucherId: string,
  adminId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const { count } = await db.kiotVoucher.updateMany({
    where: { id: voucherId, usedAt: null, revokedAt: null },
    data: { revokedAt: now(), revokedById: adminId, revokeReason: reason.slice(0, 300) },
  });
  if (count)
    await audit({ adminId, action: 'voucher.revoke', targetType: 'voucher', targetId: voucherId, reason });
  return { ok: count === 1 };
}

// Cho trang /admin/voucher: kèm tên và SĐT người nhận để CEO nhận ra tài khoản ảo.
export async function listVouchers(take = 100) {
  const rows = await db.kiotVoucher.findMany({ orderBy: { issuedAt: 'desc' }, take });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, displayName: true, phone: true, email: true },
  });
  return rows.map((r) => ({ ...r, user: users.find((u) => u.id === r.userId) ?? null }));
}
