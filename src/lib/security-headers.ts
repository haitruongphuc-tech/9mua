// Header bảo mật cho mọi trang (T36). CSP dùng nonce + 'strict-dynamic': chỉ script do chính Next.js chèn
// (mang nonce của request) mới chạy; script lạ chèn vào HTML (XSS) bị trình duyệt chặn.
export function buildCsp(nonce: string, appUrl: string): string {
  const app = new URL(appUrl);
  const sub = `${app.protocol}//*.${app.host}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind + style={{…}} trong React cần inline style; không ảnh hưởng chặn script.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    // Trên tenkiot.9mua.com, link ở thanh trên trỏ về 9mua.com (Next.js tải trước) → cho phép cả 2 tên miền.
    `connect-src 'self' ${app.origin} ${sub}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${app.origin} ${sub}`,
    "frame-ancestors 'none'",
    ...(app.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Camera/micro chỉ cho chính 9mua.com (trang Phát live — SPEC-live.md); trang nhúng hay site khác không dùng được.
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
