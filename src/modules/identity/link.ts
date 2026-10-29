import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';

// Vé liên kết (SPEC-identity.md bổ sung 27/10 và 29/10): đăng nhập Google/Facebook bằng email trùng tài khoản có sẵn thì
// chưa liên kết ngay. Vé niêm phong (AES-GCM) nằm trong cookie 10 phút; người dùng chứng minh là chủ tài khoản bằng mật
// khẩu hoặc mã gửi về email đó rồi mới liên kết.
export type LinkProvider = 'google' | 'facebook';
export type LinkTicket = { provider: LinkProvider; subject: string; email: string; exp: number };

const TICKET_TTL_MS = 10 * 60_000;

export function sealLinkTicket(t: Omit<LinkTicket, 'exp'>): string {
  return encryptSecret(JSON.stringify({ ...t, exp: now().getTime() + TICKET_TTL_MS }));
}

export function openLinkTicket(sealed: string | undefined): LinkTicket | null {
  if (!sealed) return null;
  try {
    // Vé Google cũ (trước 29/10) có `sub`, không có `provider`.
    const raw = JSON.parse(decryptSecret(sealed)) as Partial<LinkTicket> & { sub?: string };
    const t: LinkTicket = {
      provider: raw.provider ?? 'google',
      subject: raw.subject ?? raw.sub ?? '',
      email: raw.email ?? '',
      exp: raw.exp ?? 0,
    };
    if (!['google', 'facebook'].includes(t.provider) || !t.subject || !t.email) return null;
    return t.exp > now().getTime() ? t : null;
  } catch {
    return null;
  }
}

// Gắn tài khoản Google/Facebook vào đúng tài khoản có email trong vé. Admin không bao giờ được liên kết.
export async function applyLink(userId: string, t: LinkTicket): Promise<boolean> {
  const user = await db.user.findFirst({ where: { id: userId, email: t.email, role: { not: 'admin' } } });
  if (!user) return false;
  if (t.provider === 'google') {
    const { count } = await db.user.updateMany({
      where: { id: userId, googleSub: null },
      data: { googleSub: t.subject },
    });
    return count === 1;
  }
  try {
    await db.authIdentity.create({ data: { provider: t.provider, subject: t.subject, userId } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
    throw e;
  }
}

// Sau khi đăng nhập mật khẩu đúng: liên kết nếu vé còn hạn và đúng email của tài khoản.
export async function linkWithTicket(userId: string, sealed: string | undefined): Promise<boolean> {
  const t = openLinkTicket(sealed);
  return t ? applyLink(userId, t) : false;
}
