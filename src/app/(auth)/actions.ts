'use server';

import { redirect } from 'next/navigation';
import { forgetTrustedDevices } from '@/modules/admin';
import { endSession, getCurrentSessionId, getCurrentUser, invalidateOtherSessions } from '@/modules/identity';

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/');
}

export async function logoutOtherDevicesAction(): Promise<void> {
  const [user, sessionId] = await Promise.all([getCurrentUser(), getCurrentSessionId()]);
  if (user && sessionId) await invalidateOtherSessions(user.id, sessionId);
  // Admin: thiết bị đã nhớ 30 ngày cũng phải nhập mã 2 lớp lại (SPEC-admin.md bổ sung 27/10).
  if (user?.role === 'admin') await forgetTrustedDevices(user.id);
  redirect('/tai-khoan?da-dang-xuat-thiet-bi-khac=1');
}
