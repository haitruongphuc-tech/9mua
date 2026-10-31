// Header bảo mật cho mọi trang (T36). CSP dùng nonce + 'strict-dynamic': chỉ script do chính Next.js chèn
// (mang nonce của request) mới chạy; script lạ chèn vào HTML (XSS) bị trình duyệt chặn.
// mediaUrl: kho video ngoài (STORAGE_PUBLIC_URL, SPEC-creator.md V5.1 mục 9) — cho phép ảnh, video và hls.js tải đoạn.
// embed: trang /nhung/<id> (SPEC-creator.md V5.7 mục 2) cho mọi web nhúng; mọi trang khác vẫn chặn nhúng.
export function buildCsp(nonce: string, appUrl: string, mediaUrl?: string, embed = false): string {
  const app = new URL(appUrl);
  const sub = `${app.protocol}//*.${app.host}`;
  const media = mediaUrl ? ` ${new URL(mediaUrl).origin}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind + style={{…}} trong React cần inline style; không ảnh hưởng chặn script.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${media}`,
    `media-src 'self' blob:${media}`,
    "font-src 'self'",
    // Trên tenkiot.9mua.com, link ở thanh trên trỏ về 9mua.com (Next.js tải trước) → cho phép cả 2 tên miền.
    `connect-src 'self' ${app.origin} ${sub}${media}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${app.origin} ${sub}`,
    embed ? 'frame-ancestors *' : "frame-ancestors 'none'",
    ...(app.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Camera/micro (trang Phát live — SPEC-live.md) và vị trí (Gần tôi, vị trí Kiot — SPEC-marketplace.md V5.2) chỉ cho
  // chính 9mua.com; trang nhúng hay site khác không dùng được.
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
