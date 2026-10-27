import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { googleMode, sealFakeGoogleCode } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// CHỈ cho máy chạy E2E (TEST_MODE, không bao giờ trên HTTPS thật): giả màn hình "Chọn tài khoản Google".
export async function GET(request: NextRequest) {
  if (googleMode() !== 'fake') return new NextResponse('Not found', { status: 404 });
  const p = request.nextUrl.searchParams;
  const state = p.get('state') ?? '';
  const nonce = p.get('nonce') ?? '';
  const email = p.get('email');
  if (email) {
    const name = p.get('name') || email.split('@')[0]!;
    const code = sealFakeGoogleCode({ sub: `fake-${email.toLowerCase()}`, email, name }, nonce);
    const back = new URL(`${env().APP_URL}/api/auth/google/callback`);
    back.searchParams.set('code', code);
    back.searchParams.set('state', state);
    return NextResponse.redirect(back);
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><meta charset="utf-8"><title>Google (giả lập)</title>
<form method="get"><h1>Chọn tài khoản Google (giả lập E2E)</h1>
<input type="hidden" name="state" value="${esc(state)}"><input type="hidden" name="nonce" value="${esc(nonce)}">
<label>Email <input name="email" id="google-email"></label>
<label>Tên <input name="name" id="google-name"></label>
<button type="submit">Tiếp tục</button></form>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
