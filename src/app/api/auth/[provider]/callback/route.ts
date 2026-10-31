import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { LINK_COOKIE, googleCookieOptions, oauthFlowCookie } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  completeOauthLogin,
  hasCurrentCommitment,
  isOauthProvider,
  openOauthFlow,
  profileFromCode,
  startSession,
  type OauthProvider,
} from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Tên Apple chỉ gửi lần đầu, dạng JSON {"name":{"firstName","lastName"}} trong form_post.
function appleName(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '';
  try {
    const n = (JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } }).name;
    return [n?.lastName, n?.firstName]
      .filter((x): x is string => typeof x === 'string')
      .join(' ')
      .trim()
      .slice(0, 50);
  } catch {
    return '';
  }
}

async function finish(provider: OauthProvider, code: string | null, state: string | null, name = '') {
  const app = env().APP_URL;
  const jar = await cookies();
  const flow = openOauthFlow(provider, jar.get(oauthFlowCookie(provider))?.value, state);
  jar.set(oauthFlowCookie(provider), '', { ...googleCookieOptions(`/api/auth/${provider}`), maxAge: 0 });
  const fail = (c: string) =>
    NextResponse.redirect(`${app}/dang-nhap?loi-dang-nhap=${c}&qua=${provider}`, 303);
  if (!flow) return fail('het-han');
  if (provider === 'apple' && !(await isFeatureOn('apple_login'))) return fail('that-bai');
  const profile = code ? await profileFromCode(provider, code, flow).catch(() => null) : null;
  if (!profile) return fail('that-bai');
  if (!profile.name && name) profile.name = name;

  const result = await completeOauthLogin(provider, profile);
  if (result.kind === 'error') return fail(result.error === 'ADMIN' ? 'admin' : 'khoa');
  if (result.kind === 'link-required') {
    jar.set(LINK_COOKIE, result.ticket, googleCookieOptions());
    const next = encodeURIComponent(safeNextPath(flow.next));
    return NextResponse.redirect(`${app}/dang-nhap?lien-ket=${provider}&next=${next}`, 303);
  }
  await startSession(result.userId);
  const next = safeNextPath(flow.next);
  // Tài khoản mới tạo bằng Zalo/Facebook/Apple: hiện bảng cam kết nội dung trước khi vào web (SPEC-identity.md V5.6).
  if (result.created && !(await hasCurrentCommitment(result.userId)))
    return NextResponse.redirect(`${app}/cam-ket/dong-y?next=${encodeURIComponent(next)}`, 303);
  return NextResponse.redirect(`${app}${next}`, 303);
}

// Zalo/Facebook (và Apple ở máy E2E) chuyển về đây kèm mã. Kiểm state (cookie), đổi mã lấy thông tin, rồi đăng nhập /
// tạo / bắt liên kết.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOauthProvider(provider)) return new NextResponse('Not found', { status: 404 });
  const search = request.nextUrl.searchParams;
  return finish(provider, search.get('code'), search.get('state'));
}

// Apple gửi kết quả bằng POST (response_mode=form_post), kèm tên ở lần đăng nhập đầu (SPEC-identity.md V5.4).
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== 'apple') return new NextResponse('Not found', { status: 404 });
  const form = await request.formData().catch(() => null);
  const str = (k: string) => {
    const v = form?.get(k);
    return typeof v === 'string' ? v : null;
  };
  return finish(provider, str('code'), str('state'), appleName(form?.get('user') ?? null));
}
