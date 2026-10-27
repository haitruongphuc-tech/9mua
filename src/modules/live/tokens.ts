import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

// Mã phát: chuỗi ngẫu nhiên dùng một lần, chỉ lưu bản băm. Mã xem: ký HMAC (buổi, người xem, hạn), hết hạn 5 phút.
export const VIEW_TOKEN_TTL_MS = 5 * 60_000;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function newPublishToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: sha256(token) };
}

export function newMediaPath(): string {
  return `l${randomBytes(12).toString('hex')}`;
}

function key(): Buffer {
  // Khoá riêng cho mã xem, tách khỏi mục đích khác của APP_ENCRYPTION_KEY.
  return createHmac('sha256', env().APP_ENCRYPTION_KEY).update('9mua-live-view').digest();
}

export function signViewToken(liveId: string, viewerKey: string, at: number): string {
  const exp = at + VIEW_TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ l: liveId, v: viewerKey, e: exp })).toString('base64url');
  const sig = createHmac('sha256', key()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyViewToken(token: string, at: number): { liveId: string; viewerKey: string } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', key()).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { l: string; v: string; e: number };
    return p.e > at ? { liveId: p.l, viewerKey: p.v } : null;
  } catch {
    return null;
  }
}

// Băm IP để đếm "cùng mạng" mà không lưu IP gốc (SPEC-live.md "Luôn làm").
export function networkHash(ip: string): string {
  return createHmac('sha256', key()).update(`net:${ip}`).digest('hex').slice(0, 32);
}
