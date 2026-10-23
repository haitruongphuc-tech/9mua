import { IMAGE_ERROR_MESSAGES, MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/modules/identity';
import { uploadDisputeImage } from '@/modules/orders';

export const dynamic = 'force-dynamic';

// Ảnh khiếu nại: chỉ người có đơn đã giao mới tải được (chống dùng làm chỗ chứa ảnh tuỳ ý).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: 'Bạn cần đăng nhập.' }, { status: 401 });
  const eligible = await db.order.count({ where: { buyerId: user.id, status: 'delivered' } });
  if (!eligible)
    return Response.json({ ok: false, message: 'Không có đơn nào có thể khiếu nại.' }, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ ok: false, message: IMAGE_ERROR_MESSAGES.TOO_LARGE }, { status: 413 });
  }
  const file = (await request.formData()).get('file');
  if (!(file instanceof File))
    return Response.json({ ok: false, message: 'Chưa chọn ảnh.' }, { status: 400 });
  const result = await uploadDisputeImage(user.id, Buffer.from(await file.arrayBuffer()));
  if (!result.ok)
    return Response.json({ ok: false, message: IMAGE_ERROR_MESSAGES[result.error] }, { status: 400 });
  return Response.json({ ok: true, image: { id: result.url, thumbUrl: result.url } });
}
