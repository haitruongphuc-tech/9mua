// Việc chạy sau khi video lên feed (vd. social báo cho người follow). Đăng ký ở tầng ứng dụng
// (src/server/creator.ts) để creator không phụ thuộc module social.
export type VideoReadyHook = (video: {
  id: string;
  authorId: string;
  caption: string;
  kind: string;
}) => Promise<void>;

const hooks: VideoReadyHook[] = [];

export function onVideoReady(hook: VideoReadyHook): void {
  if (!hooks.includes(hook)) hooks.push(hook);
}

export async function runVideoReadyHooks(video: Parameters<VideoReadyHook>[0]): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook(video);
    } catch (e) {
      console.error('[creator] hook sau khi video lên feed lỗi:', e);
    }
  }
}
