import type { Metadata } from 'next';
import { requireUser } from '@/modules/identity';
import { MAX_VIDEOS_PER_DAY, videosToday } from '@/modules/creator';
import { VideoUploadForm } from './VideoUploadForm';

export const metadata: Metadata = { title: 'Đăng video', robots: { index: false } };

export default async function UploadVideoPage() {
  const user = await requireUser();
  const remaining = Math.max(MAX_VIDEOS_PER_DAY - (await videosToday(user.id)), 0);
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Đăng video</h1>
      <p className="text-sm text-black/70">
        Video dọc 9:16 quay bằng điện thoại. Gắn tối đa 3 sản phẩm để người xem bấm mua ngay trên video.
      </p>
      <VideoUploadForm remaining={remaining} />
    </section>
  );
}
