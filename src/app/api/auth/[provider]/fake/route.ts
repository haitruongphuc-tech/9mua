import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { isOauthProvider, oauthMode, sealFakeOauthCode } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// CHỈ cho máy chạy E2E (TEST_MODE, không bao giờ trên HTTPS thật): giả màn hình đồng ý của Zalo/Facebook.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOauthProvider(provider) || oauthMode(provider) !== 'fake')
    return new NextResponse('Not found', { status: 404 });
  const p = request.nextUrl.searchParams;
  const state = p.get('state') ?? '';
  const subject = p.get('id');
  if (subject) {
    const code = sealFakeOauthCode(
      provider,
      { subject, name: p.get('name') || 'Người dùng', email: p.get('email') || null },
      state,
    );
    const back = new URL(`${env().APP_URL}/api/auth/${provider}/callback`);
    back.searchParams.set('code', code);
    back.searchParams.set('state', state);
    return NextResponse.redirect(back);
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><meta charset="utf-8"><title>${provider} (giả lập)</title>
<form method="get"><h1>Đăng nhập ${esc(provider)} (giả lập E2E)</h1>
<input type="hidden" name="state" value="${esc(state)}">
<label>Mã tài khoản <input name="id" id="oauth-id"></label>
<label>Tên <input name="name" id="oauth-name"></label>
<label>Email <input name="email" id="oauth-email"></label>
<button type="submit">Tiếp tục</button></form>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
