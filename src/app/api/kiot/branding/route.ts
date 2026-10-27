import { kiotErrorText } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { getCurrentUser } from '@/modules/identity';
import { removeKiotImage, setKiotImage, type KiotImageKind } from '@/modules/kiot';

export const dynamic = 'force-dynamic';

const KINDS = new Set<KiotImageKind>(['logo', 'cover']);

// Tải logo / ảnh bìa Kiot (≤ 10MB). DELETE ?kind=logo|cover để gỡ.
export async function POST(request: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024)
    return Response.json({ ok: false, message: t('seller.img.TOO_LARGE') }, { status: 413 });
  const form = await request.formData();
  const kind = String(form.get('kind')) as KiotImageKind;
  const file = form.get('file');
  if (!KINDS.has(kind) || !(file instanceof File))
    return Response.json({ ok: false, message: t('seller.err.noImage') }, { status: 400 });
  const result = await setKiotImage(user.id, kind, Buffer.from(await file.arrayBuffer()));
  if (!result.ok)
    return Response.json({ ok: false, message: kiotErrorText(t, result.error) }, { status: 400 });
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
