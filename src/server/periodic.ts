import { assignMissingHandles } from '@/modules/identity';

// Việc định kỳ của đợt nâng cấp (docs/nang-cap-mot-dot.md): cron gọi /api/internal/v5/tick mỗi 5 phút và
// /api/internal/v5/daily mỗi ngày. Mỗi việc chạy riêng; một việc lỗi không chặn việc khác, kết quả ghi theo tên.
type Job = { name: string; run: () => Promise<number> };

const TICK_JOBS: Job[] = [
  // @tên cho tài khoản cũ và tài khoản mới tạo (SPEC-identity.md V5.1), mỗi lần tối đa 500.
  { name: 'handles', run: () => assignMissingHandles(500) },
];

const DAILY_JOBS: Job[] = [];

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
