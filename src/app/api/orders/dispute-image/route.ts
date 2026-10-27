import { kiotErrorText } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { db } from '@/lib/db';
import { MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { getCurrentUser } from '@/modules/identity';
import { uploadDisputeImage } from '@/modules/orders';

export const dynamic = 'force-dynamic';

// Ảnh khiếu nại: chỉ người có đơn đã giao mới tải được (chống dùng làm chỗ chứa ảnh tuỳ ý).
export async function POST(request: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  const eligible = await db.order.count({ where: { buyerId: user.id, status: 'delivered' } });
  if (!eligible) return Response.json({ ok: false, message: t('seller.err.noDisputable') }, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ ok: false, message: t('seller.img.TOO_LARGE') }, { status: 413 });
  }
  const file = (await request.formData()).get('file');
  if (!(file instanceof File))
    return Response.json({ ok: false, message: t('seller.err.noImage') }, { status: 400 });
  const result = await uploadDisputeImage(user.id, Buffer.from(await file.arrayBuffer()));
  if (!result.ok)
    return Response.json({ ok: false, message: kiotErrorText(t, result.error) }, { status: 400 });
  return Response.json({ ok: true, image: { id: result.url, thumbUrl: result.url } });
}
