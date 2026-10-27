import { kiotErrorText } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { getCurrentUser } from '@/modules/identity';
import { uploadProductImage } from '@/modules/kiot';

export const dynamic = 'force-dynamic';

// Tải từng ảnh sản phẩm lên trước khi lưu sản phẩm (mỗi request ≤ 10MB, vừa giới hạn Nginx).
export async function POST(request: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ ok: false, message: t('seller.img.TOO_LARGE') }, { status: 413 });
  }
  const file = (await request.formData()).get('file');
  if (!(file instanceof File))
    return Response.json({ ok: false, message: t('seller.err.noImage') }, { status: 400 });

  const result = await uploadProductImage(user.id, Buffer.from(await file.arrayBuffer()));
  if (!result.ok)
    return Response.json({ ok: false, message: kiotErrorText(t, result.error) }, { status: 400 });
  return Response.json({ ok: true, image: result.image });
}
