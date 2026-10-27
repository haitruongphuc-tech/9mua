'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { formatDateTimeVN } from '@/lib/format';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  ADMIN_DEVICE_COOKIE,
  confirmTotpSetup,
  markSessionVerified,
  TRUST_DAYS,
  trustDevice,
  verifyTotp,
} from '@/modules/admin';
import { getCurrentSessionId, requireAdmin } from '@/modules/identity';

export type TotpState = { error?: string; backupCodes?: string[] };

const message = (r: { error: string; until?: Date }) =>
  r.error === 'LOCKED'
    ? `Sai quá nhiều lần. Thử lại sau ${formatDateTimeVN(r.until!)}.`
    : r.error === 'NOT_SET_UP'
      ? 'Chưa cài xác thực 2 lớp.'
      : 'Mã không đúng hoặc đã dùng. Hãy nhập mã mới trên ứng dụng.';

// Hai action này chỉ yêu cầu là admin (chưa cần 2 lớp) vì chính chúng là bước nhập 2 lớp.
export async function verifyTotpAction(next: string, _p: TotpState, form: FormData): Promise<TotpState> {
  const admin = await requireAdmin();
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return { error: 'Phiên đăng nhập hết hạn.' };
  const result = await verifyTotp(admin.id, String(form.get('code') ?? ''));
  if (!result.ok) return { error: message(result) };
  await markSessionVerified(sessionId, admin.id);
  if (form.get('remember') === 'on') {
    const { token } = await trustDevice(admin.id, (await headers()).get('user-agent') ?? '');
    (await cookies()).set(ADMIN_DEVICE_COOKIE, token, {
      httpOnly: true,
      secure: env().APP_URL.startsWith('https://'),
      sameSite: 'strict',
      path: '/',
      maxAge: TRUST_DAYS * 86_400,
    });
  }
  const target = safeNextPath(next);
  redirect(target.startsWith('/admin') && !target.startsWith('/admin/xac-thuc') ? target : '/admin');
}

export async function confirmSetupAction(_p: TotpState, form: FormData): Promise<TotpState> {
  const admin = await requireAdmin();
  const sessionId = await getCurrentSessionId();
  const result = await confirmTotpSetup(admin.id, String(form.get('code') ?? ''));
  if (!result.ok) return { error: message(result) };
  if (sessionId) await markSessionVerified(sessionId, admin.id);
  return { backupCodes: result.backupCodes };
}
