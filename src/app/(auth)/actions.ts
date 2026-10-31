'use server';

import { redirect } from 'next/navigation';
import { forgetTrustedDevices } from '@/modules/admin';
import {
  endSession,
  getCurrentSessionId,
  getCurrentUser,
  invalidateOtherSessions,
  switchToNextSaved,
} from '@/modules/identity';

// Đăng xuất tài khoản đang dùng; còn tài khoản khác đã lưu trên máy thì chuyển sang (SPEC-identity.md V5.5).
export async function logoutAction(): Promise<void> {
  await endSession();
  redirect((await switchToNextSaved()) ? '/tai-khoan' : '/');
}

export async function logoutOtherDevicesAction(): Promise<void> {
  const [user, sessionId] = await Promise.all([getCurrentUser(), getCurrentSessionId()]);
  if (user && sessionId) await invalidateOtherSessions(user.id, sessionId);
  // Admin: thiết bị đã nhớ 30 ngày cũng phải nhập mã 2 lớp lại (SPEC-admin.md bổ sung 27/10).
  if (user?.role === 'admin') await forgetTrustedDevices(user.id);
  redirect('/tai-khoan/cai-dat?da-dang-xuat-thiet-bi-khac=1');
}
