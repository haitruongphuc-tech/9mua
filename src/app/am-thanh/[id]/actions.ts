'use server';

import { revalidatePath } from 'next/cache';
import { getT } from '@/i18n/server';
import { renameSound } from '@/modules/creator';
import { requireUser } from '@/modules/identity';

// Người đăng video gốc đặt lại tên âm thanh gốc (SPEC-creator.md V5.6 mục 2).
export async function renameSoundAction(soundId: string, _prev: unknown, form: FormData) {
  const user = await requireUser();
  const t = await getT();
  const r = await renameSound(user.id, soundId, String(form.get('title') ?? ''));
  if (!r.ok) return { ok: false, message: t('post.sound.renameInvalid') };
  revalidatePath(`/am-thanh/${soundId}`);
  return { ok: true, message: t('post.sound.saved') };
}
