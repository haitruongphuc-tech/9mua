import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { GOOGLE_FLOW_COOKIE, googleCookieOptions } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import { googleMode, startGoogleFlow } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Bấm "Tiếp tục với Google" → sang trang chọn tài khoản của Google (SPEC-identity.md bổ sung 27/10).
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  if (googleMode() === 'off') return NextResponse.redirect(`${env().APP_URL}/dang-nhap`);
  const { url, cookie } = startGoogleFlow(next);
  (await cookies()).set(GOOGLE_FLOW_COOKIE, cookie, googleCookieOptions('/api/auth/google'));
  return NextResponse.redirect(url);
}
