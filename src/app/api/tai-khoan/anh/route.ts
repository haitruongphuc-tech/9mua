import { kiotErrorText } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import {
  getCurrentUser,
  removeProfileImage,
  setProfileImage,
  type ProfileImageKind,
} from '@/modules/identity';

export const dynamic = 'force-dynamic';

const KINDS = new Set<ProfileImageKind>(['avatar', 'cover']);

// Tải ảnh đại diện / ảnh bìa trang cá nhân (≤ 10MB, SPEC-social.md bổ sung 30/10, A2). DELETE ?kind=avatar|cover để gỡ.
export async function POST(request: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024)
    return Response.json({ ok: false, message: t('seller.img.TOO_LARGE') }, { status: 413 });
  const form = await request.formData();
  const kind = String(form.get('kind')) as ProfileImageKind;
  const file = form.get('file');
  if (!KINDS.has(kind) || !(file instanceof File))
    return Response.json({ ok: false, message: t('seller.err.noImage') }, { status: 400 });
  const result = await setProfileImage(user.id, kind, Buffer.from(await file.arrayBuffer()));
  if (!result.ok) {
    const message =
      result.error === 'DAILY_LIMIT' ? t('profile.edit.err.DAILY_LIMIT') : kiotErrorText(t, result.error);
    return Response.json({ ok: false, message }, { status: result.error === 'DAILY_LIMIT' ? 429 : 400 });
  }
  return Response.json({ ok: true, url: result.url });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const kind = new URL(request.url).searchParams.get('kind') as ProfileImageKind;
  if (!KINDS.has(kind)) return Response.json({ ok: false }, { status: 400 });
  await removeProfileImage(user.id, kind);
  return Response.json({ ok: true });
}
