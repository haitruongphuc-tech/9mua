import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { normalizeIdentifier } from './identifier';
import { applyLink, openLinkTicket } from './link';
import { hashPassword } from './password';
import { registerInput } from './register';

// Mã 6 số gửi qua email (SPEC-identity.md bổ sung 29/10): đăng nhập/đăng ký không cần mật khẩu, liên kết Google/
// Facebook khi email trùng, thêm email cho tài khoản chưa có. Không bao giờ ghi log mã.
export type OtpPurpose = 'login' | 'link' | 'add-email' | 'set-password';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_MS = 60_000;
const PER_EMAIL_PER_HOUR = 5;
const PER_IP_PER_HOUR = 20;
const MAX_ATTEMPTS = 5;
const UNKNOWN_IP = '0.0.0.0';

const key = () => Buffer.from(env().APP_ENCRYPTION_KEY, 'hex');
const hmac = (value: string) => createHmac('sha256', key()).update(value).digest('hex');
const codeHash = (email: string, purpose: OtpPurpose, code: string) =>
  hmac(`otp:${purpose}:${email}:${code}`);
const ipHash = (ip: string) => hmac(`ip:${ip}`).slice(0, 32);

const SUBJECT: Record<OtpPurpose, string> = {
  login: 'mã đăng nhập 9MUA',
  link: 'mã liên kết tài khoản 9MUA',
  'add-email': 'mã xác nhận email 9MUA',
  'set-password': 'mã đặt mật khẩu 9MUA',
};

function normalEmail(raw: string): string | null {
  const id = normalizeIdentifier(raw);
  return id?.kind === 'email' ? id.value : null;
}

export type OtpRequestResult =
  { ok: true } | { ok: false; error: 'INVALID_EMAIL' | 'TOO_SOON' | 'TOO_MANY' | 'SEND_FAILED' };

// Không cho biết email đã có tài khoản hay chưa: email hợp lệ nào cũng nhận mã như nhau.
export async function requestEmailOtp(input: {
  email: string;
  purpose: OtpPurpose;
  ip: string;
}): Promise<OtpRequestResult> {
  const email = normalEmail(input.email);
  if (!email) return { ok: false, error: 'INVALID_EMAIL' };
  const at = now();
  const hourAgo = new Date(at.getTime() - 3_600_000);
  const ipKey = ipHash(input.ip);
  const [last, perEmail, perIp] = await Promise.all([
    db.emailOtp.findFirst({ where: { email }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.emailOtp.count({ where: { email, createdAt: { gt: hourAgo } } }),
    // IP "0.0.0.0" = không biết IP thật (chạy không qua Nginx): bỏ giới hạn theo IP để không chặn chung mọi người.
    input.ip === UNKNOWN_IP ? 0 : db.emailOtp.count({ where: { ipHash: ipKey, createdAt: { gt: hourAgo } } }),
  ]);
  if (last && at.getTime() - last.createdAt.getTime() < RESEND_MS) return { ok: false, error: 'TOO_SOON' };
  if (perEmail >= PER_EMAIL_PER_HOUR || perIp >= PER_IP_PER_HOUR) return { ok: false, error: 'TOO_MANY' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.emailOtp.create({
    data: {
      email,
      purpose: input.purpose,
      codeHash: codeHash(email, input.purpose, code),
      ipHash: ipKey,
      expiresAt: new Date(at.getTime() + CODE_TTL_MS),
      createdAt: at,
    },
  });
  try {
    await sendMail({
      to: email,
      subject: `${code} là ${SUBJECT[input.purpose]}`,
      ...renderEmail({
        title: `Mã của bạn: ${code}`,
        greeting: 'Chào bạn,',
        paragraphs: [
          `Nhập mã ${code} trên 9MUA để tiếp tục. Mã có hiệu lực 10 phút và chỉ dùng được 1 lần.`,
          'Không đưa mã này cho ai. 9MUA không bao giờ hỏi mã qua điện thoại, Zalo hay tin nhắn.',
        ],
        footnote: 'Nếu bạn không yêu cầu mã, hãy bỏ qua email này.',
      }),
    });
  } catch {
    return { ok: false, error: 'SEND_FAILED' };
  }
  return { ok: true };
}

export type OtpCheck = 'ok' | 'CODE_INVALID' | 'CODE_EXPIRED';

// Chỉ mã mới nhất còn hạn của đúng email + mục đích. Tăng số lần thử trước khi so (có điều kiện) để gửi song song
// cũng không thử quá 5 lần; đánh dấu đã dùng có điều kiện để một mã chỉ dùng được 1 lần.
async function consumeOtp(email: string, purpose: OtpPurpose, code: string): Promise<OtpCheck> {
  const at = now();
  const row = await db.emailOtp.findFirst({
    where: { email, purpose, usedAt: null, expiresAt: { gt: at } },
    orderBy: { createdAt: 'desc' },
  });
  const newest = await db.emailOtp.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!row || row.id !== newest?.id) return 'CODE_EXPIRED';
  const tried = await db.emailOtp.updateMany({
    where: { id: row.id, usedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (tried.count === 0) return 'CODE_EXPIRED';
  const given = Buffer.from(codeHash(email, purpose, code.trim()));
  const stored = Buffer.from(row.codeHash);
  if (!/^\d{6}$/.test(code.trim()) || given.length !== stored.length || !timingSafeEqual(given, stored))
    return 'CODE_INVALID';
  const used = await db.emailOtp.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: at } });
  return used.count === 1 ? 'ok' : 'CODE_EXPIRED';
}

export type OtpLoginResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: 'INVALID_EMAIL' | 'CODE_INVALID' | 'CODE_EXPIRED' | 'ADMIN' | 'LOCKED' };

// Đúng mã: email đã có tài khoản thì đăng nhập, chưa có thì tạo (tên tạm là phần trước @, mật khẩu ngẫu nhiên).
// Admin chỉ đăng nhập bằng mật khẩu + 2 lớp.
export async function loginWithEmailOtp(input: {
  email: string;
  code: string;
  displayName?: string;
}): Promise<OtpLoginResult> {
  const email = normalEmail(input.email);
  if (!email) return { ok: false, error: 'INVALID_EMAIL' };
  const check = await consumeOtp(email, 'login', input.code);
  if (check !== 'ok') return { ok: false, error: check };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === 'admin') return { ok: false, error: 'ADMIN' };
    if (existing.lockedAt) return { ok: false, error: 'LOCKED' };
    return { ok: true, userId: existing.id, created: false };
  }
  const name = input.displayName?.trim().slice(0, 50);
  try {
    const user = await db.user.create({
      data: {
        email,
        displayName: name && name.length >= 2 ? name : email.split('@')[0]!.slice(0, 50),
        passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
      },
    });
    return { ok: true, userId: user.id, created: true };
  } catch (e) {
    // Hai lần xác nhận cùng lúc cho cùng email: lần sau lấy tài khoản lần trước vừa tạo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      return { ok: true, userId: user.id, created: false };
    }
    throw e;
  }
}

export type AddEmailResult =
  | { ok: true }
  | { ok: false; error: 'INVALID_EMAIL' | 'CODE_INVALID' | 'CODE_EXPIRED' | 'EMAIL_TAKEN' | 'HAS_EMAIL' };

// Tài khoản chưa có email (thường là Zalo/Facebook) thêm email đã xác nhận bằng mã.
export async function addEmailWithOtp(
  userId: string,
  input: { email: string; code: string },
): Promise<AddEmailResult> {
  const email = normalEmail(input.email);
  if (!email) return { ok: false, error: 'INVALID_EMAIL' };
  const check = await consumeOtp(email, 'add-email', input.code);
  if (check !== 'ok') return { ok: false, error: check };
  try {
    const { count } = await db.user.updateMany({ where: { id: userId, email: null }, data: { email } });
    return count === 1 ? { ok: true } : { ok: false, error: 'HAS_EMAIL' };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'EMAIL_TAKEN' };
    throw e;
  }
}

export type LinkOtpResult =
  | { ok: true; userId: string }
  | { ok: false; error: 'TICKET_EXPIRED' | 'CODE_INVALID' | 'CODE_EXPIRED' | 'ADMIN' | 'LOCKED' };

// Liên kết Google/Facebook bằng mã gửi về email trong vé (thay cho đăng nhập mật khẩu), rồi đăng nhập tài khoản đó.
export async function linkWithOtp(sealed: string | undefined, code: string): Promise<LinkOtpResult> {
  const t = openLinkTicket(sealed);
  if (!t) return { ok: false, error: 'TICKET_EXPIRED' };
  const check = await consumeOtp(t.email, 'link', code);
  if (check !== 'ok') return { ok: false, error: check };
  const user = await db.user.findUnique({ where: { email: t.email } });
  if (!user) return { ok: false, error: 'TICKET_EXPIRED' };
  if (user.role === 'admin') return { ok: false, error: 'ADMIN' };
  if (user.lockedAt) return { ok: false, error: 'LOCKED' };
  await applyLink(user.id, t);
  return { ok: true, userId: user.id };
}

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; error: 'NO_EMAIL' | 'ADMIN' | 'INVALID_PASSWORD' | 'CODE_INVALID' | 'CODE_EXPIRED' };

// Đặt mật khẩu mới trong trang cá nhân, không cần mật khẩu cũ (CEO chốt 29/10): xác nhận bằng mã gửi về email của chính
// tài khoản, để người lấy được phiên đăng nhập không tự đặt mật khẩu được. Đăng xuất các thiết bị khác như khi đổi mật
// khẩu. Admin đổi mật khẩu bằng mật khẩu cũ (hoặc lệnh trên VPS).
export async function setPasswordWithOtp(
  userId: string,
  currentSessionId: string,
  input: { code: string; newPassword: string },
): Promise<SetPasswordResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.email) return { ok: false, error: 'NO_EMAIL' };
  if (user.role === 'admin') return { ok: false, error: 'ADMIN' };
  if (!registerInput.shape.password.safeParse(input.newPassword).success)
    return { ok: false, error: 'INVALID_PASSWORD' };
  const check = await consumeOtp(user.email, 'set-password', input.code);
  if (check !== 'ok') return { ok: false, error: check };
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
    db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } }),
  ]);
  return { ok: true };
}

// Email trong vé liên kết (để trang đăng nhập gửi mã đúng địa chỉ mà không cho người dùng tự nhập).
export const linkTicketEmail = (sealed: string | undefined) => openLinkTicket(sealed)?.email ?? null;

export const hasContact = (user: { email: string | null; phone: string | null }) =>
  Boolean(user.email || user.phone);
