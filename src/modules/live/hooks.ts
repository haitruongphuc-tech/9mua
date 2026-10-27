import type { LiveSession } from '@prisma/client';

// Việc chạy khi buổi live kết thúc (xu thưởng, báo người phát). Đăng ký ở lớp ứng dụng (src/server/live.ts) vì module
// xu phụ thuộc live chứ không ngược lại.
export type LiveEndedHook = (live: LiveSession) => Promise<void>;
const hooks: LiveEndedHook[] = [];

export function onLiveEnded(hook: LiveEndedHook): void {
  hooks.push(hook);
}

export async function runLiveEndedHooks(live: LiveSession): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook(live);
    } catch (e) {
      console.error('[live] hook kết thúc lỗi:', e instanceof Error ? e.message : e);
    }
  }
}
