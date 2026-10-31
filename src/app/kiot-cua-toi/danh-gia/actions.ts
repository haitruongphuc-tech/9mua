'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { replyReview } from '@/modules/orders';

export async function replyReviewAction(reviewId: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const r = await replyReview(user.id, reviewId, String(form.get('text') ?? ''));
  redirect(r.ok ? '/kiot-cua-toi/danh-gia' : `/kiot-cua-toi/danh-gia?loi=${r.error}`);
}
