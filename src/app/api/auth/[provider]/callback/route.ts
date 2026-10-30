import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { LINK_COOKIE, googleCookieOptions, oauthFlowCookie } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  completeOauthLogin,
  hasCurrentCommitment,
  isOauthProvider,
  openOauthFlow,
  profileFromCode,
  startSession,
} from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Zalo/Facebook chuyển về đây kèm mã. Kiểm state (cookie), đổi mã lấy thông tin, rồi đăng nhập / tạo / bắt liên kết.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOauthProvider(provider)) return new NextResponse('Not found', { status: 404 });
  const app = env().APP_URL;
  const search = request.nextUrl.searchParams;
  const jar = await cookies();
  const flow = openOauthFlow(provider, jar.get(oauthFlowCookie(provider))?.value, search.get('state'));
  jar.set(oauthFlowCookie(provider), '', { ...googleCookieOptions(`/api/auth/${provider}`), maxAge: 0 });
  const fail = (code: string) =>
    NextResponse.redirect(`${app}/dang-nhap?loi-dang-nhap=${code}&qua=${provider}`);
  if (!flow) return fail('het-han');
  const code = search.get('code');
  const profile = code ? await profileFromCode(provider, code, flow).catch(() => null) : null;
  if (!profile) return fail('that-bai');

  const result = await completeOauthLogin(provider, profile);
  if (result.kind === 'error') return fail(result.error === 'ADMIN' ? 'admin' : 'khoa');
  if (result.kind === 'link-required') {
    jar.set(LINK_COOKIE, result.ticket, googleCookieOptions());
    const next = encodeURIComponent(safeNextPath(flow.next));
    return NextResponse.redirect(`${app}/dang-nhap?lien-ket=${provider}&next=${next}`);
  }
  await startSession(result.userId);
  const next = safeNextPath(flow.next);
  // Tài khoản mới tạo bằng Zalo/Facebook: hiện bảng cam kết nội dung trước khi vào web (SPEC-identity.md V5.6).
  if (result.created && !(await hasCurrentCommitment(result.userId)))
    return NextResponse.redirect(`${app}/cam-ket/dong-y?next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${app}${next}`);
}
