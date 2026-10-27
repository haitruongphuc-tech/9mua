import { env } from './env';

// Cookie của luồng đăng nhập Google: chỉ tên miền chính, ngắn hạn, httpOnly. SameSite=Lax để còn gửi kèm khi Google
// chuyển trình duyệt quay về (điều hướng GET cấp cao nhất).
export const GOOGLE_FLOW_COOKIE = 'nm_google_flow';
export const GOOGLE_LINK_COOKIE = 'nm_google_link';

export function googleCookieOptions(path = '/') {
  return {
    httpOnly: true,
    secure: env().APP_URL.startsWith('https://'),
    sameSite: 'lax' as const,
    path,
    maxAge: 600,
  };
}
