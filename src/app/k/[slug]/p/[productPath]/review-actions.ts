'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { reportReview } from '@/modules/orders';

// Báo cáo một đánh giá (SPEC-orders.md V5.1 mục 5). back: đường dẫn trang sản phẩm (tương đối).
export async function reportReviewAction(reviewId: string, back: string): Promise<void> {
  const user = await requireUser();
  await reportReview(user.id, reviewId, 'other');
  redirect(`${back.startsWith('/') && !back.startsWith('//') ? back : '/'}?da-bao-cao=1#danh-gia`);
}
