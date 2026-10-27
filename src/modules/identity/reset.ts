import { createHash, randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { normalizeIdentifier } from './identifier';
import { hashPassword } from './password';
import { registerInput } from './register';

const TOKEN_TTL_MS = 30 * 60_000;
const MAX_REQUESTS_PER_HOUR = 3;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Chữ của email đặt lại mật khẩu; lớp giao diện truyền bản đã dịch theo ngôn ngữ người yêu cầu (SPEC-i18n.md).
export type ResetEmailCopy = {
  subject: string;
  title: string;
  greeting: string; // có {name}
  paragraph: string;
  action: string;
  footnote: string;
};

const VI_COPY: ResetEmailCopy = {
  subject: 'Đặt lại mật khẩu 9MUA',
  title: 'Đặt lại mật khẩu',
  greeting: 'Chào {name},',
  paragraph: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản 9MUA của bạn.',
  action: 'Đặt mật khẩu mới',
  footnote: 'Link có hiệu lực 30 phút và chỉ dùng được 1 lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
};

// Luôn trả cùng một kết quả để không lộ email nào đã đăng ký (SPEC-identity.md mục 5).
export async function requestPasswordReset(
  rawEmail: string,
  copy: ResetEmailCopy = VI_COPY,
): Promise<{ ok: true }> {
  const id = normalizeIdentifier(rawEmail);
  if (id?.kind !== 'email') return { ok: true };

  const user = await db.user.findUnique({ where: { email: id.value } });
  if (!user || user.lockedAt) return { ok: true };

  const current = now();
  const recent = await db.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(current.getTime() - 3_600_000) } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return { ok: true };

  const token = randomBytes(32).toString('base64url');
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(current.getTime() + TOKEN_TTL_MS),
      createdAt: current,
    },
  });

  const link = `${env().APP_URL}/dat-lai-mat-khau?token=${token}`;
  await sendMail({
    to: id.value,
    subject: copy.subject,
    ...renderEmail({
      title: copy.title,
      greeting: copy.greeting.replace('{name}', user.displayName),
      paragraphs: [copy.paragraph],
      action: { label: copy.action, url: link },
      footnote: copy.footnote,
    }),
  });
  return { ok: true };
}

export type CompleteResetResult = { ok: true } | { ok: false; error: 'INVALID_TOKEN' | 'INVALID_PASSWORD' };

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<CompleteResetResult> {
  if (!registerInput.shape.password.safeParse(newPassword).success) {
    return { ok: false, error: 'INVALID_PASSWORD' };
  }
  const passwordHash = await hashPassword(newPassword);
  const current = now();

  return db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt <= current) return { ok: false, error: 'INVALID_TOKEN' } as const;

    // Điều kiện usedAt = null bảo đảm chỉ một lần bấm thắng khi bấm đồng thời.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: current },
    });
    if (claimed.count !== 1) return { ok: false, error: 'INVALID_TOKEN' } as const;

    const user = await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: current },
    });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    // Chủ tài khoản đã chứng minh quyền qua email → gỡ khoá đăng nhập của riêng tài khoản này.
    const identifiers = [user.phone, user.email].filter((v): v is string => v !== null);
    await tx.loginAttempt.deleteMany({ where: { identifier: { in: identifiers } } });
    return { ok: true } as const;
  });
}
