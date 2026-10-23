'use server';

import { redirect } from 'next/navigation';
import { endSession, getCurrentSessionId, getCurrentUser, invalidateOtherSessions } from '@/modules/identity';

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/');
}

export async function logoutOtherDevicesAction(): Promise<void> {
  const [user, sessionId] = await Promise.all([getCurrentUser(), getCurrentSessionId()]);
  if (user && sessionId) await invalidateOtherSessions(user.id, sessionId);
  redirect('/tai-khoan?da-dang-xuat-thiet-bi-khac=1');
}
