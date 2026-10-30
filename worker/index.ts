// Tiến trình nền (service `worker` trong docker-compose): chuyển mã video và ghép video AI Studio từng cái một, để web
// không bị chậm.
import { db } from '@/lib/db';
import { cleanupAiFiles, processNextSlideshow } from '@/modules/ai';
import { cleanupStaleUploads, expireStories, processNextCaption, recomputeScores } from '@/modules/creator';
import { cleanupLiveChat } from '@/modules/live';
import { processNextJob, publishScheduledVideos } from '@/server/creator';
import { syncWithMediaServer } from '@/server/live';

const IDLE_MS = 3_000;
const CLEANUP_EVERY_MS = 3_600_000;
const SCORES_EVERY_MS = 5 * 60_000;
const LIVE_SYNC_MS = 5_000; // trạng thái buổi live theo MediaMTX (SPEC-live.md)
const SCHEDULED_EVERY_MS = 60_000; // video hẹn giờ lên feed mỗi phút (SPEC-creator.md V5.3)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    console.info(`[worker] nhận ${signal}, dừng sau việc đang làm`);
    stopping = true;
  });

async function main() {
  console.info('[worker] bắt đầu');
  let lastCleanup = 0;
  let lastScores = 0;
  while (!stopping) {
    try {
      // Video AI ghép trước (chủ Kiot đang chờ xem thử), rồi tới video người dùng tải lên.
      // Phụ đề tự động (SPEC-creator.md V5.4) làm sau cùng: video chờ đăng quan trọng hơn.
      const worked =
        (await processNextSlideshow()) || (await processNextJob()) || (await processNextCaption());
      if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) {
        const removed = await cleanupStaleUploads();
        if (removed) console.info(`[worker] dọn ${removed} file tải lên bị bỏ dở`);
        const aiRemoved = await cleanupAiFiles();
        if (aiRemoved) console.info(`[worker] dọn ${aiRemoved} ảnh AI quá 7 ngày chưa đăng bán`);
        await cleanupLiveChat(); // chat live quá 30 ngày
        lastCleanup = Date.now();
      }
      if (Date.now() - lastScores > SCORES_EVERY_MS) {
        await recomputeScores();
        await expireStories(); // Story quá 24 giờ thì ẩn, file xoá sau 7 ngày
        lastScores = Date.now();
      }
      if (!worked) await sleep(IDLE_MS);
    } catch (e) {
      console.error('[worker] lỗi vòng lặp:', e instanceof Error ? e.message : e);
      await sleep(10_000);
    }
  }
  await db.$disconnect();
  console.info('[worker] đã dừng');
}

// Vòng riêng cho live và video hẹn giờ: chuyển mã một video có thể mất vài phút, không được làm chậm việc bật/tắt buổi
// live hay video hẹn giờ lên feed.
async function liveLoop() {
  let lastScheduled = 0;
  while (!stopping) {
    await syncWithMediaServer().catch((e) =>
      console.error('[worker] đồng bộ live lỗi:', e instanceof Error ? e.message : e),
    );
    if (Date.now() - lastScheduled > SCHEDULED_EVERY_MS) {
      lastScheduled = Date.now();
      await publishScheduledVideos().catch((e) =>
        console.error('[worker] đăng video hẹn giờ lỗi:', e instanceof Error ? e.message : e),
      );
    }
    await sleep(LIVE_SYNC_MS);
  }
}

void main();
void liveLoop();
