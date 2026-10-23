import { NextResponse, type NextRequest } from 'next/server';

// Truyền đường dẫn hiện tại cho Server Component (requireUser dùng để quay lại sau khi đăng nhập).
// Định tuyến tên miền phụ tenkiot.9mua.com được thêm ở task T11.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/|api/|uploads/|brand/|favicon.ico|.*\\.png$).*)'] };
