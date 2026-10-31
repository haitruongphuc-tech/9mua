import {
  cleanupPostUploads,
  cleanupUploadSessions,
  expireDownloads,
  expireDrafts,
  publishScheduledPosts,
} from '@/modules/creator';
import { assignMissingHandles } from '@/modules/identity';
import { remindEvents, revokeLockedPoints } from '@/modules/social';
import { isFeatureOn } from '@/lib/features';
import { publishScheduledVideos } from './creator';

// Việc định kỳ của đợt nâng cấp (docs/nang-cap-mot-dot.md): cron gọi /api/internal/v5/tick mỗi 5 phút và
// /api/internal/v5/daily mỗi ngày. Mỗi việc chạy riêng; một việc lỗi không chặn việc khác, kết quả ghi theo tên.
type Job = { name: string; run: () => Promise<number> };

const TICK_JOBS: Job[] = [
  // @tên cho tài khoản cũ và tài khoản mới tạo (SPEC-identity.md V5.1), mỗi lần tối đa 500.
  { name: 'handles', run: () => assignMissingHandles(500) },
  // Video hẹn giờ (SPEC-creator.md V5.3): worker chạy mỗi phút, cron này là dự phòng khi worker dừng.
  { name: 'scheduled-videos', run: () => publishScheduledVideos() },
  // Phiên tải video từng phần quá 24 giờ: xoá file tạm (SPEC-creator.md V5.1).
  { name: 'upload-sessions', run: () => cleanupUploadSessions() },
  // Bài viết hẹn giờ (SPEC-creator.md V5.10): worker chạy mỗi phút, cron này là dự phòng.
  { name: 'scheduled-posts', run: () => publishScheduledPosts() },
  // Sự kiện sắp bắt đầu (≤ 1 giờ): báo người "Quan tâm" (SPEC-social.md V5.7).
  { name: 'event-reminders', run: () => remindEvents() },
];

const DAILY_JOBS: Job[] = [
  // Bản tải về có logo quá 7 ngày: xoá file (SPEC-creator.md V5.7 mục 1). Chạy cả khi công tắc tắt để dọn ổ.
  { name: 'downloads', run: () => expireDownloads() },
  // Điểm thưởng của tài khoản bị khoá: thu hồi bằng dòng trừ (SPEC-social.md V5.6).
  { name: 'points-revoke', run: () => revokeLockedPoints() },
  // Ảnh tải lên cho bài viết nhưng không đăng trong 24 giờ.
  { name: 'post-uploads', run: () => cleanupPostUploads() },
  // Nháp quá 90 ngày tự xoá, báo trước 7 ngày. Công tắc tắt thì người dùng không thấy tab Nháp nên không xoá.
  {
    name: 'drafts',
    run: async () => {
      if (!(await isFeatureOn('post_options'))) return 0;
      const r = await expireDrafts();
      return r.warned + r.deleted;
    },
  },
];

async function runJobs(jobs: Job[]): Promise<Record<string, number | string>> {
  const out: Record<string, number | string> = {};
  for (const job of jobs) {
    try {
      out[job.name] = await job.run();
    } catch (e) {
      console.error(`[periodic] ${job.name} lỗi:`, e);
      out[job.name] = 'error';
    }
  }
  return out;
}

export const runTick = () => runJobs(TICK_JOBS);
export const runDaily = () => runJobs(DAILY_JOBS);
