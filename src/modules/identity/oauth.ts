import { createHash, createHmac, randomBytes } from 'node:crypto';
import { lockedForLogin } from './deletion-lock';
import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sealLinkTicket } from './link';
import { hashPassword } from './password';

// Đăng nhập Zalo và Facebook (SPEC-identity.md bổ sung 29/10): OAuth 2.0 luồng authorization code, `state` niêm phong
// trong cookie; Zalo có PKCE. Máy chủ đổi mã lấy token rồi lấy mã tài khoản + tên (+ email nếu Facebook cho), không lưu
// token, không ghi log token. Không thêm thư viện npm.
export const OAUTH_PROVIDERS = ['zalo', 'facebook'] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];
export type OauthMode = 'off' | 'real' | 'fake';

const FB_GRAPH = 'v25.0';
const FLOW_TTL_MS = 10 * 60_000;

function keys(p: OauthProvider): { id?: string; secret?: string } {
  const e = env();
  return p === 'zalo'
    ? { id: e.ZALO_APP_ID, secret: e.ZALO_APP_SECRET }
    : { id: e.FACEBOOK_APP_ID, secret: e.FACEBOOK_APP_SECRET };
}

// real: đã có khoá; fake: máy chạy E2E (TEST_MODE, không bao giờ trên HTTPS thật); off: ẩn nút.
export function oauthMode(p: OauthProvider): OauthMode {
  const k = keys(p);
  if (k.id && k.secret) return 'real';
  return env().TEST_MODE === 'e2e' ? 'fake' : 'off';
}

export const isOauthProvider = (v: string): v is OauthProvider =>
  (OAUTH_PROVIDERS as readonly string[]).includes(v);
export const oauthRedirectUri = (p: OauthProvider) => `${env().APP_URL}/api/auth/${p}/callback`;

type Flow = { provider: OauthProvider; state: string; verifier: string; next: string; exp: number };

export function startOauthFlow(p: OauthProvider, next: string): { url: string; cookie: string } {
  const b64 = (n: number) => randomBytes(n).toString('base64url');
  const flow: Flow = {
    provider: p,
    state: b64(24),
    verifier: b64(48),
    next,
    exp: now().getTime() + FLOW_TTL_MS,
  };
  const k = keys(p);
  let url: string;
  if (oauthMode(p) === 'fake') {
    url = `${env().APP_URL}/api/auth/${p}/fake?${new URLSearchParams({ state: flow.state })}`;
  } else if (p === 'zalo') {
    url = `https://oauth.zaloapp.com/v4/permission?${new URLSearchParams({
      app_id: k.id ?? '',
      redirect_uri: oauthRedirectUri(p),
      state: flow.state,
      code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
      code_challenge_method: 'S256',
    })}`;
  } else {
    url = `https://www.facebook.com/${FB_GRAPH}/dialog/oauth?${new URLSearchParams({
      client_id: k.id ?? '',
      redirect_uri: oauthRedirectUri(p),
      state: flow.state,
      response_type: 'code',
      scope: 'public_profile,email',
    })}`;
  }
  return { url, cookie: encryptSecret(JSON.stringify(flow)) };
}

export function openOauthFlow(
  p: OauthProvider,
  cookie: string | undefined,
  state: string | null,
): Flow | null {
  if (!cookie || !state) return null;
  try {
    const flow = JSON.parse(decryptSecret(cookie)) as Flow;
    return flow.provider === p && flow.state === state && flow.exp > now().getTime() ? flow : null;
  } catch {
    return null;
  }
}

export type OauthProfile = { subject: string; name: string; email: string | null };

const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 50) : '');
const cleanEmail = (v: unknown) =>
  typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? v.trim().toLowerCase() : null;

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.ok) return null;
  return ((await res.json().catch(() => null)) as Record<string, unknown> | null) ?? null;
}

// Đổi mã lấy thông tin tài khoản. Lỗi gì cũng trả null (trang đăng nhập báo "Không đăng nhập được").
export async function profileFromCode(
  p: OauthProvider,
  code: string,
  flow: Flow,
  fetchImpl: typeof fetch = fetch,
): Promise<OauthProfile | null> {
  if (oauthMode(p) === 'fake') {
    try {
      const c = JSON.parse(decryptSecret(code)) as OauthProfile & { provider: string; state: string };
      return c.provider === p && c.state === flow.state
        ? { subject: c.subject, name: cleanName(c.name), email: cleanEmail(c.email) }
        : null;
    } catch {
      return null;
    }
  }
  const k = keys(p);
  const timeout = () => AbortSignal.timeout(15_000);
  if (p === 'zalo') {
    const token = await readJson(
      await fetchImpl('https://oauth.zaloapp.com/v4/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', secret_key: k.secret ?? '' },
        body: new URLSearchParams({
          code,
          app_id: k.id ?? '',
          grant_type: 'authorization_code',
          code_verifier: flow.verifier,
        }),
        signal: timeout(),
      }),
    );
    const accessToken = typeof token?.access_token === 'string' ? token.access_token : null;
    if (!accessToken) return null;
    const me = await readJson(
      await fetchImpl(`https://graph.zalo.me/v2.0/me?${new URLSearchParams({ fields: 'id,name' })}`, {
        headers: { access_token: accessToken },
        signal: timeout(),
      }),
    );
    if (!me || (me.error !== undefined && me.error !== 0) || typeof me.id !== 'string' || !me.id) return null;
    return { subject: me.id, name: cleanName(me.name), email: null };
  }
  const token = await readJson(
    await fetchImpl(
      `https://graph.facebook.com/${FB_GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: k.id ?? '',
        redirect_uri: oauthRedirectUri(p),
        client_secret: k.secret ?? '',
        code,
      })}`,
      { signal: timeout() },
    ),
  );
  const accessToken = typeof token?.access_token === 'string' ? token.access_token : null;
  if (!accessToken) return null;
  const proof = createHmac('sha256', k.secret ?? '')
    .update(accessToken)
    .digest('hex');
  const me = await readJson(
    await fetchImpl(
      `https://graph.facebook.com/${FB_GRAPH}/me?${new URLSearchParams({
        fields: 'id,name,email',
        access_token: accessToken,
        appsecret_proof: proof,
      })}`,
      { signal: timeout() },
    ),
  );
  if (!me || typeof me.id !== 'string' || !me.id) return null;
  return { subject: me.id, name: cleanName(me.name), email: cleanEmail(me.email) };
}

// Chỉ cho E2E: "màn hình đồng ý" giả tạo mã chứa thông tin tài khoản.
export const sealFakeOauthCode = (p: OauthProvider, profile: OauthProfile, state: string) =>
  encryptSecret(JSON.stringify({ ...profile, provider: p, state }));

export type OauthLoginResult =
  | { kind: 'login'; userId: string; created: boolean }
  | { kind: 'link-required'; email: string; ticket: string }
  | { kind: 'error'; error: 'ADMIN' | 'LOCKED' };

// Đã liên kết → đăng nhập. Facebook cho email trùng tài khoản có sẵn → bắt xác nhận (mật khẩu hoặc mã email) rồi mới
// liên kết. Còn lại tạo tài khoản mới (Zalo: chỉ có tên).
export async function completeOauthLogin(p: OauthProvider, profile: OauthProfile): Promise<OauthLoginResult> {
  const linked = await db.authIdentity.findUnique({
    where: { provider_subject: { provider: p, subject: profile.subject } },
    include: { user: true },
  });
  if (linked) {
    if (linked.user.role === 'admin') return { kind: 'error', error: 'ADMIN' };
    if (await lockedForLogin(linked.user)) return { kind: 'error', error: 'LOCKED' };
    return { kind: 'login', userId: linked.userId, created: false };
  }
  // Zalo không cho email; chỉ email Facebook mới được dùng.
  const email = p === 'facebook' ? profile.email : null;
  if (email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === 'admin') return { kind: 'error', error: 'ADMIN' };
      const ticket = sealLinkTicket({ provider: 'facebook', subject: profile.subject, email });
      return { kind: 'link-required', email, ticket };
    }
  }
  try {
    const user = await db.user.create({
      data: {
        email,
        displayName: profile.name.length >= 2 ? profile.name : 'Người dùng 9MUA',
        passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
        authIdentities: { create: { provider: p, subject: profile.subject } },
      },
    });
    return { kind: 'login', userId: user.id, created: true };
  } catch (e) {
    // Bấm 2 lần cùng lúc: lần sau dùng tài khoản lần trước vừa tạo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await db.authIdentity.findUnique({
        where: { provider_subject: { provider: p, subject: profile.subject } },
      });
      if (again) return { kind: 'login', userId: again.userId, created: false };
    }
    throw e;
  }
}
