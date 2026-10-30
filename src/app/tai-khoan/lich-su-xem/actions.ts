'use server';

import { revalidatePath } from 'next/cache';
import { clearViewHistory, removeFromHistory, setHistoryOff } from '@/modules/creator';
import { requireUser } from '@/modules/identity';

// Lịch sử đã xem (SPEC-creator.md V5.2): xoá từng video, xoá hết, tắt/bật ghi lịch sử.
export async function removeHistoryAction(videoId: string): Promise<void> {
  const user = await requireUser();
  await removeFromHistory(user.id, videoId);
  revalidatePath('/tai-khoan/lich-su-xem');
}

export async function clearHistoryAction(): Promise<void> {
  const user = await requireUser();
  await clearViewHistory(user.id);
  revalidatePath('/tai-khoan/lich-su-xem');
}

export async function setHistoryOffAction(off: boolean): Promise<void> {
  const user = await requireUser();
  await setHistoryOff(user.id, off);
  revalidatePath('/tai-khoan/lich-su-xem');
}
