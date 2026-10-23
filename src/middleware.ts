import { NextResponse, type NextRequest } from 'next/server';
import { routeRequest } from '@/lib/host-routing';

// tenkiot.9mua.com → /k/<slug>; www → 9mua.com; truyền đường dẫn hiện tại cho requireUser().
export function middleware(request: NextRequest) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const { pathname, search } = request.nextUrl;
  const decision = routeRequest({ host: request.headers.get('host') ?? '', pathname, search }, appUrl);

  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname + search);
  headers.delete('x-kiot-host'); // không tin header này nếu client tự gửi

  switch (decision.type) {
    case 'redirect':
      return NextResponse.redirect(decision.url, 308);
    case 'not-found':
      return new NextResponse('Not found', { status: 404 });
    case 'rewrite': {
      headers.set('x-kiot-host', '1');
      const url = request.nextUrl.clone();
      url.pathname = decision.pathname;
      return NextResponse.rewrite(url, { request: { headers } });
    }
    default:
      return NextResponse.next({ request: { headers } });
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image).*)'],
};
