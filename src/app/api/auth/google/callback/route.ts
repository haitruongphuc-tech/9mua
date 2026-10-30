import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { GOOGLE_FLOW_COOKIE, GOOGLE_LINK_COOKIE, googleCookieOptions } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  claimsFromCode,
  completeGoogleLogin,
  hasCurrentCommitment,
  openGoogleFlow,
  startSession,
} from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Google chuyển về đây kèm mã. Kiểm state (cookie), đổi mã lấy id_token, rồi đăng nhập / tạo / bắt liên kết.
export async function GET(request: NextRequest) {
  const app = env().APP_URL;
  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const flow = openGoogleFlow(jar.get(GOOGLE_FLOW_COOKIE)?.value, params.get('state'));
  jar.set(GOOGLE_FLOW_COOKIE, '', { ...googleCookieOptions('/api/auth/google'), maxAge: 0 });
  const fail = (code: string) => NextResponse.redirect(`${app}/dang-nhap?loi-google=${code}`);
  if (!flow) return fail('het-han');
  const code = params.get('code');
  const claims = code ? await claimsFromCode(code, flow).catch(() => null) : null;
  if (!claims) return fail('that-bai');

  const result = await completeGoogleLogin(claims);
  if (result.kind === 'error') return fail(result.error === 'ADMIN' ? 'admin' : 'khoa');
  if (result.kind === 'link-required') {
    jar.set(GOOGLE_LINK_COOKIE, result.ticket, googleCookieOptions());
    const next = encodeURIComponent(safeNextPath(flow.next));
    return NextResponse.redirect(`${app}/dang-nhap?lien-ket-google=1&next=${next}`);
  }
  await startSession(result.userId);
  const next = safeNextPath(flow.next);
  // Tài khoản mới tạo bằng Google: hiện bảng cam kết nội dung trước khi vào web (SPEC-identity.md V5.6).
  if (result.created && !(await hasCurrentCommitment(result.userId)))
    return NextResponse.redirect(`${app}/cam-ket/dong-y?next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${app}${next}`);
}
