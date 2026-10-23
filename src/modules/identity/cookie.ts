export const SESSION_COOKIE = 'nm_session';

// Cookie dùng chung cho 9mua.com và mọi tenkiot.9mua.com (SPEC-identity.md mục 3).
// Lưu ý dev: Chromium không chia sẻ cookie Domain=localhost sang abc.localhost; muốn thử tên miền phụ
// ở máy dev hãy dùng 9mua.test như playwright.config.ts.
export function sessionCookieOptions(appUrl: string) {
  const url = new URL(appUrl);
  const isLocal = url.hostname === 'localhost';
  return {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    domain: isLocal ? 'localhost' : `.${url.hostname}`,
  };
}
