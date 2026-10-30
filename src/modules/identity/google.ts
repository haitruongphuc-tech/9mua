import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto';
import { now } from '@/lib/clock';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { linkWithTicket, sealLinkTicket } from './link';
import { hashPassword } from './password';

// Đăng nhập Google (SPEC-identity.md, bổ sung 27/10/2026): OpenID Connect, luồng authorization code + PKCE,
// tự kiểm chữ ký id_token bằng JWKS của Google, không thêm thư viện.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const FLOW_TTL_MS = 10 * 60_000;

export type GoogleMode = 'off' | 'real' | 'fake';

// real: đã có khoá Google; fake: máy chạy E2E (TEST_MODE, không bao giờ trên HTTPS thật); off: ẩn nút.
export function googleMode(): GoogleMode {
  const e = env();
  if (e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET) return 'real';
  return e.TEST_MODE === 'e2e' ? 'fake' : 'off';
}

export const googleRedirectUri = () => `${env().APP_URL}/api/auth/google/callback`;

const b64url = (buf: Buffer) => buf.toString('base64url');
export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest());

type Flow = { state: string; nonce: string; verifier: string; next: string; exp: number };

// Bắt đầu: tạo state/nonce/verifier, niêm phong vào cookie (AES-GCM) và trả địa chỉ chuyển sang Google.
export function startGoogleFlow(next: string): { url: string; cookie: string } {
  const flow: Flow = {
    state: b64url(randomBytes(24)),
    nonce: b64url(randomBytes(24)),
    verifier: b64url(randomBytes(48)),
    next,
    exp: now().getTime() + FLOW_TTL_MS,
  };
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: googleRedirectUri(),
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: pkceChallenge(flow.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  const url =
    googleMode() === 'fake'
      ? `${env().APP_URL}/api/auth/google/fake?${params}`
      : `${AUTH_URL}?${params}&client_id=${encodeURIComponent(env().GOOGLE_CLIENT_ID ?? '')}`;
  return { url, cookie: encryptSecret(JSON.stringify(flow)) };
}

export function openGoogleFlow(cookie: string | undefined, state: string | null): Flow | null {
  if (!cookie || !state) return null;
  try {
    const flow = JSON.parse(decryptSecret(cookie)) as Flow;
    return flow.state === state && flow.exp > now().getTime() ? flow : null;
  } catch {
    return null;
  }
}

export type GoogleClaims = { sub: string; email: string; name: string };

type Jwk = JsonWebKey & { kid?: string };
type JwksFetcher = () => Promise<Jwk[]>;

let jwksCache: { keys: Jwk[]; until: number } | null = null;
const fetchJwks: JwksFetcher = async () => {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  jwksCache = { keys, until: Date.now() + Math.min(maxAge, 86_400) * 1000 };
  return keys;
};

// Kiểm id_token: chữ ký RS256 theo kid, iss, aud, exp, nonce, email đã xác minh.
export async function verifyGoogleIdToken(
  idToken: string,
  opts: { clientId: string; nonce: string; jwks?: JwksFetcher; nowMs?: number },
): Promise<GoogleClaims | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const jwk = (await (opts.jwks ?? fetchJwks)()).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const ok = verify(
    'RSA-SHA256',
    Buffer.from(`${h}.${p}`),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(s, 'base64url'),
  );
  if (!ok) return null;

  const nowSec = (opts.nowMs ?? now().getTime()) / 1000;
  const aud = payload.aud;
  if (
    !ISSUERS.includes(String(payload.iss)) ||
    !(aud === opts.clientId || (Array.isArray(aud) && aud.includes(opts.clientId))) ||
    typeof payload.exp !== 'number' ||
    payload.exp < nowSec - 60 ||
    payload.nonce !== opts.nonce ||
    payload.email_verified !== true ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string'
  )
    return null;
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : payload.email.split('@')[0]!,
  };
}

// Đổi mã lấy id_token rồi kiểm. Ở chế độ fake (E2E) mã chính là thông tin người dùng đã niêm phong.
export async function claimsFromCode(code: string, flow: Flow): Promise<GoogleClaims | null> {
  if (googleMode() === 'fake') {
    try {
      const c = JSON.parse(decryptSecret(code)) as GoogleClaims & { nonce: string };
      return c.nonce === flow.nonce ? { sub: c.sub, email: c.email.toLowerCase(), name: c.name } : null;
    } catch {
      return null;
    }
  }
  const e = env();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: e.GOOGLE_CLIENT_ID ?? '',
      client_secret: e.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  return idToken
    ? verifyGoogleIdToken(idToken, { clientId: e.GOOGLE_CLIENT_ID ?? '', nonce: flow.nonce })
    : null;
}

// Chỉ cho E2E: "màn hình đồng ý" giả tạo mã chứa thông tin người dùng.
export const sealFakeGoogleCode = (claims: GoogleClaims, nonce: string) =>
  encryptSecret(JSON.stringify({ ...claims, nonce }));

export type GoogleLoginResult =
  | { kind: 'login'; userId: string; created?: boolean } // created: vừa tạo tài khoản mới (bổ sung 30/10)
  | { kind: 'link-required'; email: string; ticket: string }
  | { kind: 'error'; error: 'ADMIN' | 'LOCKED' };

// Tài khoản đã liên kết → đăng nhập; email trùng tài khoản cũ → bắt đăng nhập mật khẩu để liên kết; email mới →
// tạo tài khoản (mật khẩu ngẫu nhiên không ai biết).
export async function completeGoogleLogin(claims: GoogleClaims): Promise<GoogleLoginResult> {
  const linked = await db.user.findUnique({ where: { googleSub: claims.sub } });
  if (linked) {
    if (linked.role === 'admin') return { kind: 'error', error: 'ADMIN' };
    if (linked.lockedAt) return { kind: 'error', error: 'LOCKED' };
    return { kind: 'login', userId: linked.id };
  }
  const existing = await db.user.findUnique({ where: { email: claims.email } });
  if (existing) {
    if (existing.role === 'admin') return { kind: 'error', error: 'ADMIN' };
    const ticket = sealLinkTicket({ provider: 'google', subject: claims.sub, email: claims.email });
    return { kind: 'link-required', email: claims.email, ticket };
  }
  const user = await db.user.create({
    data: {
      email: claims.email,
      googleSub: claims.sub,
      displayName: claims.name.trim().slice(0, 50) || claims.email.split('@')[0]!.slice(0, 50),
      passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
    },
  });
  return { kind: 'login', userId: user.id, created: true };
}

// Sau khi đăng nhập mật khẩu đúng: liên kết nếu vé còn hạn và đúng email của tài khoản (giữ tên cũ trong hợp đồng;
// vé giờ dùng chung cho Google và Facebook).
export const linkGoogleWithTicket = linkWithTicket;
