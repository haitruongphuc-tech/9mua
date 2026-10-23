import { createHash, randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import type { SessionUser } from './types';

const DAY = 86_400_000;
const SESSION_TTL = 30 * DAY;
const RENEW_WHEN_LESS_THAN = 15 * DAY;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now().getTime() + SESSION_TTL);
  const session = await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, sessionId: session.id, expiresAt };
}

export type ValidatedSession = { sessionId: string; user: SessionUser; expiresAt: Date; renewed: boolean };

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  const current = now();
  if (session.expiresAt <= current || session.user.lockedAt) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  // Gia hạn trượt: chỉ ghi DB khi còn dưới 15 ngày, tránh ghi mỗi request.
  let { expiresAt } = session;
  const renewed = expiresAt.getTime() - current.getTime() < RENEW_WHEN_LESS_THAN;
  if (renewed) {
    expiresAt = new Date(current.getTime() + SESSION_TTL);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } });
  }

  const { id, displayName, role, phone, email, mustChangePassword } = session.user;
  return {
    sessionId: session.id,
    expiresAt,
    renewed,
    user: { id, displayName, role, phone, email, mustChangePassword },
  };
}

export async function invalidateSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function invalidateAllSessions(
  userId: string,
  options: { except?: string } = {},
): Promise<void> {
  await db.session.deleteMany({
    where: { userId, ...(options.except ? { id: { not: options.except } } : {}) },
  });
}

export function invalidateOtherSessions(userId: string, currentSessionId: string): Promise<void> {
  return invalidateAllSessions(userId, { except: currentSessionId });
}
