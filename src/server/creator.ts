// Lớp ghép ở tầng ứng dụng: việc chạy khi video lên feed (social báo cho người follow — SPEC-social.md mục 1).
// Worker và route xử lý video PHẢI import processNextJob từ đây.
import { onVideoReady, processNextJob } from '@/modules/creator';
import { notifyFollowersOfVideo } from '@/modules/social';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  onVideoReady(async (video) => {
    if (video.kind === 'video') await notifyFollowersOfVideo(video);
  });
}

registerAll();

export { processNextJob };
