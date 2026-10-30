// Lớp ghép ở tầng ứng dụng: việc chạy khi video lên feed (social báo cho người follow — SPEC-social.md mục 1).
// Worker và route xử lý video PHẢI import processNextJob từ đây; nháp / hẹn giờ lên feed cũng vậy (changePostTiming,
// publishScheduledVideos) để người follow được báo.
import { changePostTiming, onVideoReady, processNextJob, publishScheduledVideos } from '@/modules/creator';
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

export { processNextJob, changePostTiming, publishScheduledVideos };
