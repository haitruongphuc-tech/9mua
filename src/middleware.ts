import { NextResponse, type NextRequest } from 'next/server';
import { routeRequest } from '@/lib/host-routing';
import { buildCsp, STATIC_SECURITY_HEADERS } from '@/lib/security-headers';

// tenkiot.9mua.com → /k/<slug>; www → 9mua.com; truyền đường dẫn hiện tại cho requireUser().
export function middleware(request: NextRequest) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const { pathname, search } = request.nextUrl;
  const decision = routeRequest({ host: request.headers.get('host') ?? '', pathname, search }, appUrl);

  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname + search);
  headers.delete('x-kiot-host'); // không tin header này nếu client tự gửi

  // CSP theo nonce chỉ bật ở bản build production (next dev cần eval cho tải lại nóng).
  const csp =
    process.env.NODE_ENV === 'production' ? buildCsp(crypto.randomUUID().replace(/-/g, ''), appUrl) : null;
  if (csp) headers.set('content-security-policy', csp); // Next.js đọc nonce từ đây để gắn vào script của nó

  const secure = (res: NextResponse) => {
    if (csp) res.headers.set('Content-Security-Policy', csp);
    for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) res.headers.set(k, v);
    return res;
  };

  switch (decision.type) {
    case 'redirect':
      return NextResponse.redirect(decision.url, 308);
    case 'not-found':
      return secure(new NextResponse('Not found', { status: 404 }));
    case 'rewrite': {
      headers.set('x-kiot-host', '1');
      // Lưu ý (T36): Next.js đổi 127.0.0.1 thành localhost trong URL của middleware. Nếu server chạy với
      // HOSTNAME=127.0.0.1, Next tưởng rewrite này là địa chỉ ngoài và tự proxy — sau Nginx/HTTPS thì lỗi 500.
      // Image Docker đặt HOSTNAME=0.0.0.0; e2e/internal.spec.ts kiểm lại với X-Forwarded-Proto: https.
      const url = new URL(decision.pathname + search, request.url);
      return secure(NextResponse.rewrite(url, { request: { headers } }));
    }
    default:
      return secure(NextResponse.next({ request: { headers } }));
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image).*)'],
};
