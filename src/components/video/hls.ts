// Phát video dài HLS (SPEC-creator.md V5.1 mục 8): Safari phát sẵn; Chrome/Android dùng hls.js, chỉ tải thư viện khi
// gặp video HLS. Trả hàm gỡ để giải phóng bộ nhớ khi video đã cuộn xa.
export const isHls = (url: string) => url.endsWith('.m3u8');

export async function attachHls(el: HTMLVideoElement, url: string): Promise<() => void> {
  if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url;
    return () => {
      el.removeAttribute('src');
      el.load();
    };
  }
  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) {
    el.src = url;
    return () => {};
  }
  // Chọn mức theo khung hình và tốc độ mạng; không tải trước quá 20 giây để đỡ tốn dữ liệu.
  const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 20 });
  hls.loadSource(url);
  hls.attachMedia(el);
  return () => hls.destroy();
}

// Mạng chậm hoặc bật tiết kiệm dữ liệu: video ≤ 60 giây phát bản 480p.
export function prefersLowData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return Boolean(c && (c.saveData || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? '')));
}
