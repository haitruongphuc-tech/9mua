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
  // Trang nhúng /nhung/<id> (SPEC-creator.md V5.7 mục 2): web khác được nhúng, không gửi X-Frame-Options.
  const embed = pathname.startsWith('/nhung/');
  const csp =
    process.env.NODE_ENV === 'production'
      ? buildCsp(
          crypto.randomUUID().replace(/-/g, ''),
          appUrl,
          process.env.STORAGE_PUBLIC_URL || undefined,
          embed,
          process.env.MAP_TILE_URL || undefined,
        )
      : null;
  if (csp) headers.set('content-security-policy', csp); // Next.js đọc nonce từ đây để gắn vào script của nó

  const secure = (res: NextResponse) => {
    if (csp) res.headers.set('Content-Security-Policy', csp);
    for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS))
      if (!(embed && k === 'X-Frame-Options')) res.headers.set(k, v);
    return res;
  };

  // Trang cá nhân 9mua.com/@<tên> (SPEC-identity.md V5.1) nằm ở /u/<tên>.
  const at = decision.type === 'next' ? /^\/@([^/]+)$/.exec(pathname) : null;
  if (at)
    return secure(
      NextResponse.rewrite(new URL(`/u/${at[1]}${search}`, request.url), { request: { headers } }),
    );

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
  // Bỏ qua các đường tải file lên: Next.js chép thân request qua middleware và làm rơi phần đuôi khi mạng chậm
  // (31/10: iPhone 4G gửi 8MB, app chỉ nhận ~8,1MB → BAD_PART). Các đường này không cần định tuyến Kiot.
  matcher: ['/((?!_next/static|_next/image|api/uploads/|api/video/upload|api/video/recording).*)'],
};
