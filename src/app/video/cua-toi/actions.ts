'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { deleteVideo, pinToProfile } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { changePostTiming } from '@/server/creator';

export async function deleteVideoAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await deleteVideo(String(form.get('videoId') ?? ''), user.id);
  revalidatePath('/video/cua-toi');
}

// Nháp / hẹn giờ (SPEC-creator.md V5.3): đăng ngay, hẹn giờ hoặc đổi giờ (giờ Việt Nam), huỷ hẹn về Nháp.
export async function postTimingAction(form: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await isFeatureOn('post_options'))) return;
  const videoId = String(form.get('videoId') ?? '');
  const mode = String(form.get('mode') ?? '');
  const at = String(form.get('at') ?? '');
  const asked = String(form.get('back') ?? '');
  const back = /^\/video\/cua-toi(\?[\w=&-]*)?$/.test(asked) ? asked : '/video/cua-toi';
  const result =
    mode === 'now'
      ? await changePostTiming(user.id, videoId, { mode: 'now' })
      : mode === 'draft'
        ? await changePostTiming(user.id, videoId, { mode: 'draft' })
        : await changePostTiming(user.id, videoId, {
            mode: 'schedule',
            at: new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) ? `${at}:00+07:00` : 'x'),
          });
  revalidatePath('/video/cua-toi');
  const sep = back.includes('?') ? '&' : '?';
  redirect(result.ok ? back : `${back}${sep}loi=${result.error}`);
}

// Ghim / bỏ ghim video lên đầu trang cá nhân (tối đa 3).
export async function pinProfileAction(form: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await isFeatureOn('post_options'))) return;
  const result = await pinToProfile(user.id, String(form.get('videoId') ?? ''), form.get('on') === '1');
  revalidatePath('/video/cua-toi');
  if (!result.ok) redirect(`/video/cua-toi?loi=${result.error}`);
}
