'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { respondFollowRequest } from '@/modules/social';

// Chấp nhận / từ chối yêu cầu follow (SPEC-identity.md V5.2).
export async function respondFollowRequestAction(requesterId: string, accept: boolean): Promise<void> {
  const user = await requireUser();
  await respondFollowRequest(user.id, requesterId, accept);
  redirect('/tai-khoan/yeu-cau-follow');
}
