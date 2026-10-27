import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getCurrentSessionId, getCurrentUser, requireAdmin, type SessionUser } from '@/modules/identity';
import { ADMIN_DEVICE_COOKIE, isTrustedDevice } from './devices';
import { getTotpStatus } from './totp';

export const ADMIN_SESSION_HOURS = 12;

// Đánh dấu phiên đăng nhập hiện tại đã qua bước 2 lớp.
export async function markSessionVerified(sessionId: string, userId: string): Promise<void> {
  await db.adminSessionVerification.upsert({
    where: { sessionId },
    create: { sessionId, userId, verifiedAt: now() },
    update: { userId, verifiedAt: now() },
  });
}

export async function isSessionVerified(sessionId: string, userId: string): Promise<boolean> {
  const row = await db.adminSessionVerification.findUnique({ where: { sessionId } });
  return Boolean(
    row &&
    row.userId === userId &&
    now().getTime() - row.verifiedAt.getTime() < ADMIN_SESSION_HOURS * 3_600_000,
  );
}

// Phiên đã nhập mã, hoặc thiết bị đã nhớ 30 ngày: coi như đã nhập mã cho phiên này (phiên mới vẫn phải đăng nhập
// mật khẩu). Chỉ gọi trong request (đọc cookie thiết bị).
async function verifiedOrTrusted(sessionId: string, userId: string): Promise<boolean> {
  if (await isSessionVerified(sessionId, userId)) return true;
  if (!(await isTrustedDevice(userId, (await cookies()).get(ADMIN_DEVICE_COOKIE)?.value))) return false;
  await markSessionVerified(sessionId, userId);
  return true;
}

// Mọi trang, Server Action và API của admin gọi hàm này trước tiên:
// không phải admin → 404; chưa cài 2 lớp → trang cài; chưa nhập mã trong 12 giờ → trang nhập mã.
export async function requireAdminVerified(): Promise<SessionUser> {
  const admin = await requireAdmin();
  const sessionId = await getCurrentSessionId();
  const path = (await headers()).get('x-pathname') ?? '/admin';
  if ((await getTotpStatus(admin.id)) !== 'enabled') redirect('/admin/xac-thuc/cai-dat');
  if (!sessionId || !(await verifiedOrTrusted(sessionId, admin.id)))
    redirect(`/admin/xac-thuc?next=${encodeURIComponent(path.startsWith('/admin') ? path : '/admin')}`);
  return admin;
}

// Cho API admin: không chuyển trang, chỉ trả null khi không phải admin đã qua 2 lớp (route trả 404).
export async function getVerifiedAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return null;
  const sessionId = await getCurrentSessionId();
  if (!sessionId || (await getTotpStatus(user.id)) !== 'enabled') return null;
  return (await verifiedOrTrusted(sessionId, user.id)) ? user : null;
}
