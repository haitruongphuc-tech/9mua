import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { normalizeIdentifier } from './identifier';
import { hashPassword, verifyPassword } from './password';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; error: 'INVALID_CREDENTIALS' | 'TOO_MANY_ATTEMPTS' | 'ACCOUNT_LOCKED' };

// Chuỗi băm giả để thời gian phản hồi giống nhau dù tài khoản có tồn tại hay không.
let dummyHash: Promise<string> | undefined;

export async function login(input: { identifier: string; password: string }): Promise<LoginResult> {
  const id = normalizeIdentifier(input.identifier);
  const key = id?.value ?? input.identifier.trim().toLowerCase().slice(0, 120);

  const since = new Date(now().getTime() - WINDOW_MS);
  const failures = await db.loginAttempt.count({ where: { identifier: key, createdAt: { gt: since } } });
  if (failures >= MAX_FAILURES) return { ok: false, error: 'TOO_MANY_ATTEMPTS' };

  const user = id ? await db.user.findUnique({ where: id.where }) : null;
  dummyHash ??= hashPassword('9mua-dummy-password');
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);

  if (!user || !valid) {
    await db.loginAttempt.create({ data: { identifier: key, createdAt: now() } });
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }
  if (user.lockedAt) return { ok: false, error: 'ACCOUNT_LOCKED' };

  await db.loginAttempt.deleteMany({ where: { identifier: key } });
  return { ok: true, userId: user.id };
}
