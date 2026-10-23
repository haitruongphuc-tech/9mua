import { IMAGE_ERROR_MESSAGES, MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { getCurrentUser } from '@/modules/identity';
import { uploadProductImage } from '@/modules/kiot';
import { KIOT_ERROR_MESSAGES } from '@/modules/kiot/messages';

export const dynamic = 'force-dynamic';

// Tải từng ảnh sản phẩm lên trước khi lưu sản phẩm (mỗi request ≤ 10MB, vừa giới hạn Nginx).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: 'Bạn cần đăng nhập.' }, { status: 401 });

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ ok: false, message: IMAGE_ERROR_MESSAGES.TOO_LARGE }, { status: 413 });
  }
  const file = (await request.formData()).get('file');
  if (!(file instanceof File))
    return Response.json({ ok: false, message: 'Chưa chọn ảnh.' }, { status: 400 });

  const result = await uploadProductImage(user.id, Buffer.from(await file.arrayBuffer()));
  if (!result.ok) {
    const message =
      result.error in IMAGE_ERROR_MESSAGES
        ? IMAGE_ERROR_MESSAGES[result.error as keyof typeof IMAGE_ERROR_MESSAGES]
        : KIOT_ERROR_MESSAGES[result.error as keyof typeof KIOT_ERROR_MESSAGES];
    return Response.json({ ok: false, message }, { status: 400 });
  }
  return Response.json({ ok: true, image: result.image });
}
