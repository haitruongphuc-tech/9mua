'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { exchangePoints } from '@/modules/social';

// Đổi điểm ra xu (SPEC-social.md V5.6 mục 6, công tắc points_exchange — tắt sẵn).
export async function exchangePointsAction(): Promise<void> {
  const user = await requireUser();
  const r = await exchangePoints(user.id);
  redirect(r.ok ? `/tai-khoan?doi-diem=${r.xu}` : `/tai-khoan?loi-doi-diem=${r.error}`);
}
