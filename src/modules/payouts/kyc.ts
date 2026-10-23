import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { readPrivate, savePrivate } from '@/lib/media/private-store';
import { processImage } from '@/lib/media/process-image';
import { getKiotByOwner, getPayoutAccount, normalizeAccountName } from '@/modules/kiot';

export type KycResult =
  | { ok: true }
  | { ok: false; error: 'ALREADY_PENDING' | 'ALREADY_APPROVED' | 'INVALID_IMAGE' }
  | { ok: false; error: 'INVALID_INPUT'; message: string };

// Nộp CCCD (SPEC-payouts.md mục 3). Ảnh xoá metadata và lưu vào PRIVATE_DIR theo từng người dùng.
export async function submitKyc(
  userId: string,
  input: { fullName: string; idNumber: string; front: Buffer; back: Buffer },
): Promise<KycResult> {
  const fullName = normalizeAccountName(input.fullName);
  const idNumber = input.idNumber.replace(/\D/g, '');
  if (fullName.length < 3)
    return { ok: false, error: 'INVALID_INPUT', message: 'Nhập họ tên đúng như trên CCCD' };
  if (!/^\d{12}$/.test(idNumber))
    return { ok: false, error: 'INVALID_INPUT', message: 'Số CCCD gồm 12 chữ số' };

  const latest = await db.kycSubmission.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (latest?.status === 'pending') return { ok: false, error: 'ALREADY_PENDING' };
  if (latest?.status === 'approved') return { ok: false, error: 'ALREADY_APPROVED' };

  const [front, back] = await Promise.all([processImage(input.front), processImage(input.back)]);
  if (!front.ok || !back.ok) return { ok: false, error: 'INVALID_IMAGE' };
  const dir = `kyc/${userId}/${randomBytes(8).toString('hex')}`;
  const frontImage = await savePrivate(`${dir}/front.webp`, front.main);
  const backImage = await savePrivate(`${dir}/back.webp`, back.main);
  await db.kycSubmission.create({
    data: { userId, fullName, idNumber, frontImage, backImage, createdAt: now() },
  });
  return { ok: true };
}

export async function getKycStatus(userId: string) {
  return db.kycSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, reason: true, fullName: true, idNumber: true, createdAt: true },
  });
}

export async function isKycApproved(userId: string): Promise<boolean> {
  return (await getKycStatus(userId))?.status === 'approved';
}

// Hàng chờ của CEO: kèm cảnh báo khi tên tài khoản nhận tiền khác tên trên CCCD.
export async function listKycForReview(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const subs = await db.kycSubmission.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  return Promise.all(
    subs.map(async (s) => {
      const kiot = await getKiotByOwner(s.userId);
      const account = kiot ? await getPayoutAccount(kiot.id) : null;
      return {
        ...s,
        kiotName: kiot?.name ?? null,
        bankAccountName: account?.accountName ?? null,
        nameMatchesBank: account ? account.accountName === s.fullName : null,
      };
    }),
  );
}

export async function reviewKyc(
  kycId: string,
  adminId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'REASON_REQUIRED' | 'ALREADY_REVIEWED' }> {
  if (decision === 'reject' && !reason?.trim()) return { ok: false, error: 'REASON_REQUIRED' };
  const updated = await db.kycSubmission.updateMany({
    where: { id: kycId, status: 'pending' },
    data: {
      status: decision === 'approve' ? 'approved' : 'rejected',
      reason: reason?.trim() || null,
      reviewedById: adminId,
      reviewedAt: now(),
    },
  });
  if (updated.count === 1) return { ok: true };
  return (await db.kycSubmission.count({ where: { id: kycId } }))
    ? { ok: false, error: 'ALREADY_REVIEWED' }
    : { ok: false, error: 'NOT_FOUND' };
}

// Chỉ route admin gọi (đã kiểm requireAdmin).
export async function readKycImage(kycId: string, side: 'front' | 'back'): Promise<Buffer | null> {
  const sub = await db.kycSubmission.findUnique({ where: { id: kycId } });
  if (!sub) return null;
  return readPrivate(side === 'front' ? sub.frontImage : sub.backImage);
}
