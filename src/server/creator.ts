// Lớp ghép ở tầng ứng dụng: việc chạy khi video lên feed (social báo cho người follow — SPEC-social.md mục 1).
// Worker và route xử lý video PHẢI import processNextJob từ đây; nháp / hẹn giờ lên feed cũng vậy (changePostTiming,
// publishScheduledVideos) để người follow được báo.
import {
  changePostTiming,
  notifyNewEpisode,
  onVideoReady,
  processNextJob,
  publishScheduledVideos,
} from '@/modules/creator';
import { notifyFollowersOfVideo, notifyVideoReply, recordMentions } from '@/modules/social';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  onVideoReady(async (video) => {
    if (video.kind === 'video') await notifyFollowersOfVideo(video);
    // Tập phim mới (SPEC-creator.md V5.9): báo người đã "Lưu phim".
    if (video.kind === 'video') await notifyNewEpisode(video.id);
    // Trả lời bình luận bằng video (SPEC-creator.md V5.8): báo người bình luận.
    if (video.kind === 'video') await notifyVideoReply(video.id);
    // Nhắc tên @ trong chú thích (SPEC-social.md V5.4 mục 2).
    await recordMentions(
      { type: 'video', id: video.id, url: `/v/${video.id}` },
      video.authorId,
      video.caption,
    );
  });
}

registerAll();

export { processNextJob, changePostTiming, publishScheduledVideos };
