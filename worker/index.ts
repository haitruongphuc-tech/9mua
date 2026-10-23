// Tiến trình nền (service `worker` trong docker-compose): chuyển mã video từng cái một, để web không bị chậm.
import { db } from '@/lib/db';
import { cleanupStaleUploads, processNextJob, recomputeScores } from '@/modules/creator';

const IDLE_MS = 3_000;
const CLEANUP_EVERY_MS = 3_600_000;
const SCORES_EVERY_MS = 5 * 60_000;
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
      const worked = await processNextJob();
      if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) {
        const removed = await cleanupStaleUploads();
        if (removed) console.info(`[worker] dọn ${removed} file tải lên bị bỏ dở`);
        lastCleanup = Date.now();
      }
      if (Date.now() - lastScores > SCORES_EVERY_MS) {
        await recomputeScores();
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

void main();
