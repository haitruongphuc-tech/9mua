'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { LINK_COOKIE, googleCookieOptions } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  addEmailWithOtp,
  getCurrentUser,
  linkTicketEmail,
  linkWithOtp,
  linkWithTicket,
  loginWithEmailOtp,
  requestEmailOtp,
  startSession,
} from '@/modules/identity';

// Đăng nhập/đăng ký bằng mã email, liên kết Google/Facebook bằng mã, thêm email (SPEC-identity.md bổ sung 29/10).
export type OtpMode = 'login' | 'link' | 'add-email';
export type OtpSendResult = { ok: true; email: string } | { ok: false; message: string };
export type OtpVerifyResult = { ok: true } | { ok: false; message: string };

async function message(code: string): Promise<string> {
  return (await getT())(`auth.otp.err.${code}` as 'auth.otp.err.CODE_INVALID');
}

export async function sendOtpAction(mode: OtpMode, rawEmail: string): Promise<OtpSendResult> {
  const jar = await cookies();
  let email = rawEmail;
  if (mode === 'link') {
    const fromTicket = linkTicketEmail(jar.get(LINK_COOKIE)?.value);
    if (!fromTicket) return { ok: false, message: await message('TICKET_EXPIRED') };
    email = fromTicket;
  }
  if (mode === 'add-email' && !(await getCurrentUser()))
    return { ok: false, message: await message('TICKET_EXPIRED') };
  // Giới hạn theo IP chỉ dùng IP do Nginx đặt (X-Real-IP); không có thì coi như không biết IP (otp.ts bỏ giới hạn IP).
  const ip = (await headers()).get('x-real-ip') ?? '0.0.0.0';
  const r = await requestEmailOtp({ email, purpose: mode, ip });
  return r.ok
    ? { ok: true, email: email.trim().toLowerCase() }
    : { ok: false, message: await message(r.error) };
}

export async function verifyOtpAction(
  mode: OtpMode,
  input: { email: string; code: string; displayName?: string; next?: string },
): Promise<OtpVerifyResult> {
  const jar = await cookies();
  const next = safeNextPath(input.next);
  if (mode === 'add-email') {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: await message('TICKET_EXPIRED') };
    const r = await addEmailWithOtp(user.id, { email: input.email, code: input.code });
    return r.ok ? { ok: true } : { ok: false, message: await message(r.error) };
  }
  if (mode === 'link') {
    const r = await linkWithOtp(jar.get(LINK_COOKIE)?.value, input.code);
    if (!r.ok) return { ok: false, message: await message(r.error) };
    jar.set(LINK_COOKIE, '', { ...googleCookieOptions(), maxAge: 0 });
    await startSession(r.userId);
    redirect(next);
  }
  const r = await loginWithEmailOtp({ email: input.email, code: input.code, displayName: input.displayName });
  if (!r.ok) return { ok: false, message: await message(r.error) };
  await startSession(r.userId);
  // Vừa được yêu cầu xác nhận để liên kết Google/Facebook mà đăng nhập bằng mã đúng email đó: liên kết luôn.
  const ticket = jar.get(LINK_COOKIE)?.value;
  if (ticket) {
    await linkWithTicket(r.userId, ticket);
    jar.set(LINK_COOKIE, '', { ...googleCookieOptions(), maxAge: 0 });
  }
  redirect(next);
}
