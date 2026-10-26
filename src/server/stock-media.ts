// Lấy ảnh và video thật từ kho ảnh miễn phí cho dữ liệu mẫu (src/server/demo-data.ts).
// - Pixabay: khoá miễn phí ở pixabay.com/api/docs (đăng nhập là thấy), 100 lượt/phút.
// - Pexels: tạm ngừng cấp khoá mới (10/2026); ai đã có khoá vẫn dùng được, 200 lượt/giờ.
// Giấy phép cả hai cho dùng miễn phí, kể cả mục đích thương mại, không bắt ghi nguồn. File được tải về VPS
// (không trỏ link thẳng sang kho). Mọi lỗi (mạng, sai khoá, không có kết quả) đều trả null để nơi gọi dùng
// ảnh vẽ sẵn thay thế.
const MAX_VIDEO_SECONDS = 30;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_CONSECUTIVE_FAILURES = 3;

export type StockMedia = {
  photo(query: string, shape?: 'square' | 'landscape'): Promise<Buffer | null>;
  video(query: string): Promise<Buffer | null>;
};

function httpClient(fetchFn: typeof fetch) {
  // Mạng chặn, sai khoá hay kho ảnh quá tải: lỗi liên tiếp 3 lần thì thôi gọi cho cả lần chạy.
  let failures = 0;
  return {
    // URL có thể chứa khoá API (Pixabay): không bao giờ in ra log.
    async json<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
      if (failures >= MAX_CONSECUTIVE_FAILURES) return null;
      try {
        const res = await fetchFn(url, { headers, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        failures = 0;
        return data;
      } catch {
        failures += 1;
        return null;
      }
    },
    // File ảnh/video nằm trên CDN của kho ảnh, không cần (và không gửi) khoá API.
    async download(url: string | undefined): Promise<Buffer | null> {
      if (!url) return null;
      try {
        const res = await fetchFn(url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) return null;
        const data = Buffer.from(await res.arrayBuffer());
        return data.length > 0 && data.length <= MAX_DOWNLOAD_BYTES ? data : null;
      } catch {
        return null;
      }
    },
  };
}

type PexelsPhoto = { src?: { large2x?: string; landscape?: string } };
type PexelsVideo = {
  duration?: number;
  width?: number;
  height?: number;
  video_files?: { file_type?: string; height?: number | null; link?: string }[];
};

export function createPexels(apiKey: string, fetchFn: typeof fetch = fetch): StockMedia {
  const http = httpClient(fetchFn);
  const api = (path: string, params: Record<string, string>) =>
    http.json(`https://api.pexels.com${path}?${new URLSearchParams(params)}`, { Authorization: apiKey });

  return {
    async photo(query, shape = 'square') {
      const found = (await api('/v1/search', { query, orientation: shape, per_page: '1' })) as {
        photos?: PexelsPhoto[];
      } | null;
      const src = found?.photos?.[0]?.src;
      return http.download(shape === 'landscape' ? (src?.landscape ?? src?.large2x) : src?.large2x);
    },

    // Video dọc, ngắn; lấy file mp4 nhỏ nhất mà vẫn cao từ 960px (worker chuyển mã về 720p nên không cần nét hơn).
    async video(query) {
      const found = (await api('/videos/search', {
        query,
        orientation: 'portrait',
        size: 'medium',
        per_page: '15',
      })) as { videos?: PexelsVideo[] } | null;
      for (const v of found?.videos ?? []) {
        if (!v.duration || v.duration > MAX_VIDEO_SECONDS || (v.height ?? 0) <= (v.width ?? 0)) continue;
        const file = (v.video_files ?? [])
          .filter((f) => f.file_type === 'video/mp4' && f.link && (f.height ?? 0) >= 960)
          .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))[0];
        if (file) return http.download(file.link);
      }
      return null;
    },
  };
}

type PixabayFile = { url?: string; width?: number; height?: number; size?: number };
type PixabayVideo = {
  duration?: number;
  videos?: Partial<Record<'large' | 'medium' | 'small' | 'tiny', PixabayFile>>;
};

export function createPixabay(apiKey: string, fetchFn: typeof fetch = fetch): StockMedia {
  const http = httpClient(fetchFn);
  // Pixabay nhận khoá qua tham số key; per_page phải trong khoảng 3–200.
  const api = (path: string, params: Record<string, string>) =>
    http.json(
      `https://pixabay.com/api/${path}?${new URLSearchParams({ key: apiKey, safesearch: 'true', ...params })}`,
    );

  return {
    async photo(query, shape = 'square') {
      const found = (await api('', {
        q: query.slice(0, 100),
        image_type: 'photo',
        orientation: shape === 'landscape' ? 'horizontal' : 'all',
        per_page: '3',
      })) as { hits?: { largeImageURL?: string; webformatURL?: string }[] } | null;
      const hit = found?.hits?.[0];
      return http.download(hit?.largeImageURL || hit?.webformatURL);
    },

    // Kho video Pixabay phần lớn quay ngang: ưu tiên video dọc, không có thì lấy video ngang (feed hiện viền đen).
    // Lấy bản nhỏ nhất có cạnh ngắn từ 540px (worker chuyển mã về 720p nên không cần nét hơn).
    async video(query) {
      const found = (await api('videos/', {
        q: query.slice(0, 100),
        video_type: 'film',
        per_page: '20',
      })) as {
        hits?: PixabayVideo[];
      } | null;
      const candidates = (found?.hits ?? [])
        .filter((v) => v.duration && v.duration <= MAX_VIDEO_SECONDS)
        .map((v) => {
          const file = Object.values(v.videos ?? {})
            .filter(
              (f): f is Required<PixabayFile> =>
                !!f?.url &&
                Math.min(f.width ?? 0, f.height ?? 0) >= 540 &&
                (f.size ?? 0) <= MAX_DOWNLOAD_BYTES,
            )
            .sort((a, b) => a.width * a.height - b.width * b.height)[0];
          return file ? { file, portrait: file.height > file.width } : null;
        })
        .filter((c) => c !== null);
      const pick = candidates.find((c) => c.portrait) ?? candidates[0];
      return http.download(pick?.file.url);
    },
  };
}
