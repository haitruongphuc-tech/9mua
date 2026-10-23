import { z } from 'zod';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { formatDateTimeVN } from '@/lib/format';
import { verifyUserPassword } from '@/modules/identity';
import { findBank } from './banks';

export function normalizeAccountName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const accountInput = z.object({
  bankBin: z.string().refine((bin) => Boolean(findBank(bin)), 'Chọn ngân hàng'),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(/^\d{6,19}$/, 'Số tài khoản gồm 6–19 chữ số')),
  accountName: z
    .string()
    .transform(normalizeAccountName)
    .pipe(z.string().min(3, 'Nhập tên chủ tài khoản đúng như trên ngân hàng').max(70)),
});

type Field = keyof z.input<typeof accountInput>;

export type SetPayoutAccountResult =
  | { ok: true }
  | { ok: false; error: 'NO_KIOT' | 'WRONG_PASSWORD' }
  | { ok: false; error: 'INVALID_INPUT'; fields: Partial<Record<Field, string>> };

const mask = (n: string) => `${'*'.repeat(Math.max(n.length - 4, 0))}${n.slice(-4)}`;

// Đổi tài khoản nhận tiền: bắt nhập lại mật khẩu, lưu lịch sử, gửi email báo (SPEC-kiot.md mục 3).
export async function setPayoutAccount(
  userId: string,
  raw: { bankBin: string; accountNumber: string; accountName: string; password: string },
): Promise<SetPayoutAccountResult> {
  const kiot = await db.kiot.findUnique({ where: { ownerId: userId }, include: { owner: true } });
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  const parsed = accountInput.safeParse(raw);
  if (!parsed.success) {
    const fields: Partial<Record<Field, string>> = {};
    for (const i of parsed.error.issues) fields[i.path[0] as Field] ??= i.message;
    return { ok: false, error: 'INVALID_INPUT', fields };
  }
  if (!(await verifyUserPassword(userId, raw.password))) return { ok: false, error: 'WRONG_PASSWORD' };

  const at = now();
  await db.kiotPayoutAccount.create({
    data: { ...parsed.data, kiotId: kiot.id, createdById: userId, createdAt: at },
  });

  if (kiot.owner.email) {
    const bank = findBank(parsed.data.bankBin)!;
    await sendMail({
      to: kiot.owner.email,
      subject: 'Tài khoản nhận tiền của Kiot đã thay đổi',
      ...renderEmail({
        title: 'Tài khoản nhận tiền đã thay đổi',
        greeting: `Chào ${kiot.owner.displayName},`,
        paragraphs: [
          `Tài khoản nhận tiền bán hàng của Kiot ${kiot.name} vừa được đổi lúc ${formatDateTimeVN(at)}:`,
          `${bank.shortName} — ${mask(parsed.data.accountNumber)} — ${parsed.data.accountName}`,
          'Để bảo vệ bạn, yêu cầu rút tiền sẽ tạm giữ 24 giờ sau khi đổi tài khoản.',
        ],
        footnote: 'Nếu không phải bạn đổi, hãy đổi mật khẩu ngay và liên hệ 9MUA.',
      }),
    });
  }
  return { ok: true };
}

export async function getPayoutAccount(kiotId: string) {
  const row = await db.kiotPayoutAccount.findFirst({
    where: { kiotId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (!row) return null;
  return {
    bankBin: row.bankBin,
    bankName: findBank(row.bankBin)?.shortName ?? row.bankBin,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    changedAt: row.createdAt,
  };
}
