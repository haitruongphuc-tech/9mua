import { IMAGE_ERROR_MESSAGES, MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { getCurrentUser } from '@/modules/identity';
import { removeKiotImage, setKiotImage, type KiotImageKind } from '@/modules/kiot';
import { KIOT_ERROR_MESSAGES } from '@/modules/kiot/messages';

export const dynamic = 'force-dynamic';

const KINDS = new Set<KiotImageKind>(['logo', 'cover']);

// Tải logo / ảnh bìa Kiot (≤ 10MB). DELETE ?kind=logo|cover để gỡ.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: 'Bạn cần đăng nhập.' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024)
    return Response.json({ ok: false, message: IMAGE_ERROR_MESSAGES.TOO_LARGE }, { status: 413 });
  const form = await request.formData();
  const kind = String(form.get('kind')) as KiotImageKind;
  const file = form.get('file');
  if (!KINDS.has(kind) || !(file instanceof File))
    return Response.json({ ok: false, message: 'Chưa chọn ảnh.' }, { status: 400 });
  const result = await setKiotImage(user.id, kind, Buffer.from(await file.arrayBuffer()));
  if (!result.ok) {
    const message =
      result.error === 'NO_KIOT' ? KIOT_ERROR_MESSAGES.NO_KIOT : IMAGE_ERROR_MESSAGES[result.error];
    return Response.json({ ok: false, message }, { status: 400 });
  }
  return Response.json({ ok: true, url: result.url });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const kind = new URL(request.url).searchParams.get('kind') as KiotImageKind;
  if (!KINDS.has(kind)) return Response.json({ ok: false }, { status: 400 });
  await removeKiotImage(user.id, kind);
  return Response.json({ ok: true });
}
