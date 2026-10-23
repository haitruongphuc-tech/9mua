'use server';

import { parseVndInput } from '@/lib/format';
import {
  adjustKiotBalance,
  grantKiotYear,
  issueTempPassword,
  lockKiotAccount,
  lockUserAccount,
  requireAdminVerified,
  sendResetLink,
  unlockKiotAccount,
  unlockUserAccount,
  type AdminResult,
} from '@/modules/admin';
import { back } from '../flash';

const reason = (form: FormData) => String(form.get('reason') ?? '');
const done = (q: string, r: AdminResult): never =>
  back(
    `/admin/tra-cuu?${q}`.replace(/\?$/, ''),
    r.ok ? { ok: true, message: r.message ?? 'Xong.' } : { ok: false, message: r.error },
  );

export async function lockUserAction(userId: string, q: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  done(q, await lockUserAccount(admin.id, userId, reason(form)));
}

export async function unlockUserAction(userId: string, q: string): Promise<void> {
  const admin = await requireAdminVerified();
  done(q, await unlockUserAccount(admin.id, userId));
}

export async function sendResetLinkAction(userId: string, q: string): Promise<void> {
  const admin = await requireAdminVerified();
  done(q, await sendResetLink(admin.id, userId));
}

// Mật khẩu tạm hiện 1 lần ngay trên trang cho CEO đọc qua điện thoại (người dùng bắt buộc đổi khi đăng
// nhập). Không đưa lên URL để không lọt vào lịch sử trình duyệt hay log máy chủ.
export async function tempPasswordAction(userId: string): Promise<{ password?: string; error?: string }> {
  const admin = await requireAdminVerified();
  const r = await issueTempPassword(admin.id, userId);
  return r.ok ? { password: r.tempPassword } : { error: r.error };
}

export async function lockKiotAction(kiotId: string, q: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  done(q, await lockKiotAccount(admin.id, kiotId, reason(form)));
}

export async function unlockKiotAction(kiotId: string, q: string): Promise<void> {
  const admin = await requireAdminVerified();
  done(q, await unlockKiotAccount(admin.id, kiotId));
}

export async function grantYearAction(kiotId: string, q: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  done(q, await grantKiotYear(admin.id, kiotId, reason(form)));
}

export async function adjustBalanceAction(kiotId: string, q: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const sign = form.get('sign') === '-' ? -1 : 1;
  done(
    q,
    await adjustKiotBalance(admin.id, kiotId, sign * (parseVndInput(form.get('amount')) ?? 0), reason(form)),
  );
}
