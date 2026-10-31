'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { endSession, requestEmailOtp, requireUser } from '@/modules/identity';
import { requestAccountDeletion } from '@/server/account-delete';

const PAGE = '/tai-khoan/xoa-tai-khoan';

// Tự xoá tài khoản (SPEC-identity.md V5.3), công tắc account_more.
async function owner() {
  const user = await requireUser();
  if (!(await isFeatureOn('account_more'))) redirect('/tai-khoan/cai-dat');
  return user;
}

export async function sendDeleteCodeAction(): Promise<void> {
  const user = await owner();
  if (!user.email) redirect(`${PAGE}?loi=NO_EMAIL`);
  const r = await requestEmailOtp({
    email: user.email,
    purpose: 'delete-account',
    ip: (await headers()).get('x-real-ip') ?? '0.0.0.0',
  });
  redirect(r.ok ? `${PAGE}?da-gui-ma=1` : `${PAGE}?loi=SEND_FAILED`);
}

export async function deleteAccountAction(form: FormData): Promise<void> {
  const user = await owner();
  const code = String(form.get('code') ?? '').trim();
  const r = await requestAccountDeletion(
    user.id,
    code ? { code } : { password: String(form.get('password') ?? '') },
  );
  if (!r.ok) redirect(`${PAGE}?loi=${r.error}`);
  await endSession();
  redirect('/?da-xoa-tai-khoan=1');
}
