// Lấy ảnh và video thật từ Pexels cho dữ liệu mẫu (src/server/demo-data.ts). Giấy phép Pexels cho dùng miễn phí,
// kể cả mục đích thương mại, không bắt ghi nguồn. Khoá API miễn phí ở pexels.com/api, giới hạn 200 lượt/giờ.
// Mọi lỗi (mạng, sai khoá, không có kết quả) đều trả null để nơi gọi dùng ảnh vẽ sẵn thay thế.
const API = 'https://api.pexels.com';
const MAX_VIDEO_SECONDS = 30;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_CONSECUTIVE_FAILURES = 3;

type PexelsPhoto = { src?: { large2x?: string; landscape?: string } };
type PexelsVideoFile = {
  quality?: string | null;
  file_type?: string;
  width?: number | null;
  height?: number | null;
  link?: string;
};
type PexelsVideo = { duration?: number; width?: number; height?: number; video_files?: PexelsVideoFile[] };

export type Pexels = {
  photo(query: string, shape?: 'square' | 'landscape'): Promise<Buffer | null>;
  video(query: string): Promise<Buffer | null>;
};

export function createPexels(apiKey: string, fetchFn: typeof fetch = fetch): Pexels {
  // Mạng chặn, sai khoá hay Pexels quá tải: lỗi liên tiếp 3 lần thì thôi gọi cho cả lần chạy.
  let failures = 0;
  async function search<T>(path: string, params: Record<string, string>): Promise<T | null> {
    if (failures >= MAX_CONSECUTIVE_FAILURES) return null;
    try {
      const res = await fetchFn(`${API}${path}?${new URLSearchParams(params)}`, {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as T;
      failures = 0;
      return data;
    } catch {
      failures += 1;
      return null;
    }
  }

  // File ảnh/video nằm trên CDN của Pexels, không cần (và không gửi) khoá API.
  async function download(url: string | undefined): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) return null;
      const data = Buffer.from(await res.arrayBuffer());
      return data.length > 0 && data.length <= MAX_DOWNLOAD_BYTES ? data : null;
    } catch {
      return null;
    }
  }

  return {
    async photo(query, shape = 'square') {
      const found = await search<{ photos?: PexelsPhoto[] }>('/v1/search', {
        query,
        orientation: shape,
        per_page: '1',
      });
      const src = found?.photos?.[0]?.src;
      return download(shape === 'landscape' ? (src?.landscape ?? src?.large2x) : src?.large2x);
    },

    // Video dọc, ngắn; lấy file mp4 nhỏ nhất mà vẫn cao từ 960px (worker chuyển mã về 720p nên không cần nét hơn).
    async video(query) {
      const found = await search<{ videos?: PexelsVideo[] }>('/videos/search', {
        query,
        orientation: 'portrait',
        size: 'medium',
        per_page: '15',
      });
      for (const v of found?.videos ?? []) {
        if (!v.duration || v.duration > MAX_VIDEO_SECONDS || (v.height ?? 0) <= (v.width ?? 0)) continue;
        const file = (v.video_files ?? [])
          .filter((f) => f.file_type === 'video/mp4' && f.link && (f.height ?? 0) >= 960)
          .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))[0];
        if (file) return download(file.link);
      }
      return null;
    },
  };
}
