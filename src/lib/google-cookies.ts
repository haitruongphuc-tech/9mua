import { env } from './env';

// Cookie của luồng đăng nhập Google: chỉ tên miền chính, ngắn hạn, httpOnly. SameSite=Lax để còn gửi kèm khi Google
// chuyển trình duyệt quay về (điều hướng GET cấp cao nhất).
export const GOOGLE_FLOW_COOKIE = 'nm_google_flow';
// Vé liên kết dùng chung cho Google và Facebook (SPEC-identity.md bổ sung 29/10); giữ tên cookie cũ.
export const GOOGLE_LINK_COOKIE = 'nm_google_link';
export const LINK_COOKIE = GOOGLE_LINK_COOKIE;
// Luồng Zalo/Facebook: mỗi nhà cung cấp một cookie, chỉ gửi kèm đường /api/auth/<tên>.
export const oauthFlowCookie = (provider: string) => `nm_${provider}_flow`;

export function googleCookieOptions(path = '/') {
  return {
    httpOnly: true,
    secure: env().APP_URL.startsWith('https://'),
    sameSite: 'lax' as const,
    path,
    maxAge: 600,
  };
}
