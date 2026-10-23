'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { createVideoUpload } from '@/modules/creator';

const MESSAGES = {
  NOT_FOUND: 'Không tìm thấy file vừa tải lên, hãy chọn lại video.',
  TOO_LARGE: 'Video tối đa 100MB.',
  DAILY_LIMIT: 'Mỗi ngày đăng tối đa 10 video.',
  BAD_FORMAT: 'File không phải video MP4, MOV hoặc WebM.',
  PRODUCT_INVALID: 'Có sản phẩm không còn bán. Hãy bỏ chọn rồi thử lại (tối đa 3 sản phẩm).',
  CAPTION_TOO_LONG: 'Chú thích tối đa 300 ký tự.',
} as const;

// Bước 2: tạo video từ file đã tải lên; worker sẽ chuyển mã rồi đưa lên feed.
export async function createVideoAction(input: {
  uploadId: string;
  caption: string;
  productIds: string[];
}): Promise<{ error: string }> {
  const user = await requireUser();
  const result = await createVideoUpload(user.id, String(input.uploadId), {
    caption: String(input.caption ?? ''),
    productIds: Array.isArray(input.productIds) ? input.productIds.map(String).slice(0, 10) : [],
  });
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/video/cua-toi?moi=${result.videoId}`);
}
