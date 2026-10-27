import { createHash, randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { passwordFingerprint } from '@/modules/identity';

// Nhớ thiết bị 30 ngày cho bước 2 lớp (SPEC-admin.md bổ sung 27/10, CEO chọn câu 6 "a"). Thiết bị chỉ được nhớ sau
// khi đã nhập đúng mã; đổi mật khẩu hoặc bấm "Quên mọi thiết bị" thì phải nhập mã lại.
export const ADMIN_DEVICE_COOKIE = 'nm_admin_device';
export const TRUST_DAYS = 30;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function trustDevice(
  userId: string,
  userAgent: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now().getTime() + TRUST_DAYS * 86_400_000);
  await db.adminTrustedDevice.create({
    data: {
      userId,
      tokenHash: hash(token),
      pwFingerprint: await passwordFingerprint(userId),
      userAgent: userAgent.slice(0, 300),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function isTrustedDevice(userId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await db.adminTrustedDevice.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.userId !== userId || row.revokedAt || row.expiresAt <= now()) return false;
  if (row.pwFingerprint !== (await passwordFingerprint(userId))) return false;
  await db.adminTrustedDevice.update({ where: { id: row.id }, data: { lastUsedAt: now() } });
  return true;
}

export async function forgetTrustedDevices(userId: string): Promise<number> {
  const { count } = await db.adminTrustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now() },
  });
  return count;
}

export async function listTrustedDevices(userId: string) {
  return db.adminTrustedDevice.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
  });
}
