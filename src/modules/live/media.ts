import { env } from '@/lib/env';

// Nói chuyện với máy chủ hình MediaMTX qua API nội bộ (cổng 9997, chỉ trong mạng Docker — SPEC-live.md "Không bao
// giờ mở API quản trị ra Internet"). Bản giả dùng cho test/E2E: máy chạy test không có MediaMTX.
export interface MediaServer {
  readyPaths(): Promise<Set<string>>; // các đường đang nhận được hình
  kick(path: string): Promise<void>; // ngắt người phát và người xem của một đường
  whipUrl(path: string): string;
  whepUrl(path: string): string;
}

type PathsList = { items?: { name: string; ready?: boolean }[] };
type SessionsList = { items?: { id: string; path: string }[] };

export function mediamtx(apiUrl = env().MEDIAMTX_API_URL, fetchImpl: typeof fetch = fetch): MediaServer {
  const api = (p: string, init?: RequestInit) =>
    fetchImpl(`${apiUrl}${p}`, { ...init, signal: AbortSignal.timeout(5_000), cache: 'no-store' });
  return {
    async readyPaths() {
      const res = await api('/v3/paths/list?itemsPerPage=1000');
      if (!res.ok) throw new Error(`MediaMTX API ${res.status}`);
      const data = (await res.json()) as PathsList;
      return new Set((data.items ?? []).filter((i) => i.ready).map((i) => i.name));
    },
    async kick(path) {
      const res = await api('/v3/webrtcsessions/list?itemsPerPage=1000').catch(() => null);
      const data = res?.ok ? ((await res.json()) as SessionsList) : { items: [] };
      await Promise.all(
        (data.items ?? [])
          .filter((s) => s.path === path)
          .map((s) =>
            api(`/v3/webrtcsessions/kick/${encodeURIComponent(s.id)}`, { method: 'POST' }).catch(() => null),
          ),
      );
    },
    whipUrl: (path) => `${env().APP_URL}/live-media/${path}/whip`,
    whepUrl: (path) => `${env().APP_URL}/live-media/${path}/whep`,
  };
}

// Máy chủ hình giả: route /api/live/fake-media (chỉ khi TEST_MODE=e2e) đánh dấu "có hình" khi trình duyệt gửi WHIP.
const fakeReady = new Set<string>();
export const fakeMedia: MediaServer & { setReady(path: string, ready: boolean): void } = {
  async readyPaths() {
    return new Set(fakeReady);
  },
  async kick(path) {
    fakeReady.delete(path);
  },
  whipUrl: (path) => `/api/live/fake-media/${path}/whip`,
  whepUrl: (path) => `/api/live/fake-media/${path}/whep`,
  setReady(path, ready) {
    if (ready) fakeReady.add(path);
    else fakeReady.delete(path);
  },
};

export function mediaServer(): MediaServer {
  return env().MEDIA_DRIVER === 'fake' ? fakeMedia : mediamtx();
}
