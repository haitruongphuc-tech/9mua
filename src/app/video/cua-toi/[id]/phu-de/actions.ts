'use server';

import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { saveCaptions } from '@/modules/creator';
import { requireUser } from '@/modules/identity';

// Người đăng sửa chữ phụ đề và bật / tắt cho người xem (SPEC-creator.md V5.4 mục 2).
export async function saveCaptionsAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const videoId = String(form.get('videoId') ?? '');
  if (!(await isFeatureOn('auto_captions'))) redirect('/video/cua-toi');
  const result = await saveCaptions(user.id, videoId, {
    vtt: String(form.get('vtt') ?? ''),
    published: form.get('published') === 'on',
  });
  redirect(`/video/cua-toi/${encodeURIComponent(videoId)}/phu-de?${result.ok ? 'luu=1' : 'loi=1'}`);
}
