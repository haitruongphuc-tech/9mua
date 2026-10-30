'use server';

import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { createSeries, setEpisode, updateSeries } from '@/modules/creator';
import { requireUser } from '@/modules/identity';

// Phim của tôi (SPEC-creator.md V5.9 mục 1–2): tạo / sửa phim, gắn hoặc gỡ tập.
const fields = (form: FormData) => ({
  title: String(form.get('title') ?? ''),
  description: String(form.get('description') ?? ''),
  genre: String(form.get('genre') ?? ''),
  status: String(form.get('status') ?? ''),
});

async function guard() {
  const user = await requireUser();
  if (!(await isFeatureOn('watch'))) redirect('/video/cua-toi');
  return user;
}

export async function createSeriesAction(form: FormData): Promise<void> {
  const user = await guard();
  const r = await createSeries(user.id, fields(form));
  redirect(r.ok ? `/video/cua-toi/phim/${r.seriesId}?moi=1` : `/video/cua-toi/phim?loi=${r.error}`);
}

export async function updateSeriesAction(seriesId: string, form: FormData): Promise<void> {
  const user = await guard();
  const r = await updateSeries(user.id, seriesId, fields(form));
  redirect(`/video/cua-toi/phim/${seriesId}?${r.ok ? 'xong=1' : `loi=${r.error}`}`);
}

export async function setEpisodeAction(seriesId: string, videoId: string, form: FormData): Promise<void> {
  const user = await guard();
  const remove = form.get('remove') === '1';
  const r = await setEpisode(
    user.id,
    videoId,
    remove
      ? null
      : {
          seriesId,
          episodeNo: Number(form.get('episodeNo')),
          watchOnly: form.get('watchOnly') === 'on',
        },
  );
  redirect(`/video/cua-toi/phim/${seriesId}?${r.ok ? 'xong=1' : `loi=${r.error}`}`);
}
