import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { googleCookieOptions, oauthFlowCookie } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import { isFeatureOn } from '@/lib/features';
import { isOauthProvider, oauthMode, startOauthFlow } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Bấm "Tiếp tục với Zalo/Facebook" → sang trang đồng ý của Zalo/Facebook (SPEC-identity.md bổ sung 29/10).
// Google có route riêng (/api/auth/google/*, đường tĩnh được ưu tiên).
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOauthProvider(provider)) return new NextResponse('Not found', { status: 404 });
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  if (oauthMode(provider) === 'off' || (provider === 'apple' && !(await isFeatureOn('apple_login'))))
    return NextResponse.redirect(`${env().APP_URL}/dang-nhap`);
  const { url, cookie } = startOauthFlow(provider, next);
  const options = googleCookieOptions(`/api/auth/${provider}`);
  // Apple quay về bằng POST từ appleid.apple.com: cookie SameSite=Lax không được gửi kèm, nên dùng None (cần HTTPS).
  (await cookies()).set(
    oauthFlowCookie(provider),
    cookie,
    provider === 'apple' && options.secure ? { ...options, sameSite: 'none' } : options,
  );
  return NextResponse.redirect(url);
}
