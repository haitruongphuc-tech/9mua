import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { now } from '@/lib/clock';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;
export const BACKUP_CODE_COUNT = 10;
const ISSUER = '9MUA Admin';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const normalizeBackup = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const epoch = () => Math.floor(now().getTime() / 1000);

export async function getTotpStatus(userId: string): Promise<'none' | 'pending' | 'enabled'> {
  const row = await db.adminTotp.findUnique({ where: { userId } });
  return !row ? 'none' : row.enabledAt ? 'enabled' : 'pending';
}

const PENDING_REUSE_MS = 10 * 60_000;

// Bắt đầu cài: tạo bí mật (mã hoá khi lưu), trả về QR để quét bằng Google Authenticator/Authy. Mở lại trang
// trong 10 phút thì dùng lại bí mật đang cài (QR vừa quét vẫn đúng); quá 10 phút thì tạo bí mật mới.
// Đã bật rồi thì không cho tạo lại (tránh kẻ có phiên đăng nhập thay thiết bị 2 lớp).
export async function beginTotpSetup(
  userId: string,
  label: string,
): Promise<{ qrSvg: string; secret: string } | null> {
  const existing = await db.adminTotp.findUnique({ where: { userId } });
  if (existing?.enabledAt) return null;
  let secret: string;
  if (existing && now().getTime() - existing.updatedAt.getTime() < PENDING_REUSE_MS) {
    secret = decryptSecret(existing.secretEnc);
  } else {
    secret = generateSecret();
    await db.adminTotp.upsert({
      where: { userId },
      create: { userId, secretEnc: encryptSecret(secret), backupHashes: [], updatedAt: now() },
      update: { secretEnc: encryptSecret(secret), backupHashes: [], lastTimeStep: null, updatedAt: now() },
    });
  }
  const uri = generateURI({ issuer: ISSUER, label, secret });
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { qrSvg, secret };
}

export type VerifyResult =
  | { ok: true; backupCodes?: string[]; usedBackup?: boolean }
  | { ok: false; error: 'LOCKED'; until: Date }
  | { ok: false; error: 'INVALID' | 'NOT_SET_UP' };

async function lockedUntil(userId: string): Promise<Date | null> {
  const since = new Date(now().getTime() - LOCK_MINUTES * 60_000);
  const lastSuccess = await db.adminTotpAttempt.findFirst({
    where: { userId, success: true },
    orderBy: { createdAt: 'desc' },
  });
  const failures = await db.adminTotpAttempt.findMany({
    where: {
      userId,
      success: false,
      createdAt: { gte: lastSuccess && lastSuccess.createdAt > since ? lastSuccess.createdAt : since },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_FAILED,
  });
  if (failures.length < MAX_FAILED) return null;
  return new Date(failures[0]!.createdAt.getTime() + LOCK_MINUTES * 60_000);
}

async function checkCode(secretEnc: string, lastTimeStep: number | null, code: string) {
  const token = code.replace(/\D/g, '');
  if (token.length !== 6) return null;
  const result = await verify({
    secret: decryptSecret(secretEnc),
    token,
    epoch: epoch(),
    epochTolerance: 30, // chấp nhận lệch đồng hồ ±30 giây
    ...(lastTimeStep !== null ? { afterTimeStep: lastTimeStep } : {}),
  }).catch(() => null);
  // verify() chung cho HOTP/TOTP: chỉ kết quả TOTP mới có timeStep.
  return result?.valid && 'timeStep' in result ? result.timeStep : null;
}

function newBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

// Xác nhận cài đặt bằng mã đầu tiên; trả về 10 mã dự phòng (chỉ hiện 1 lần).
export async function confirmTotpSetup(userId: string, code: string): Promise<VerifyResult> {
  const row = await db.adminTotp.findUnique({ where: { userId } });
  if (!row || row.enabledAt) return { ok: false, error: 'NOT_SET_UP' };
  const until = await lockedUntil(userId);
  if (until) return { ok: false, error: 'LOCKED', until };
  const step = await checkCode(row.secretEnc, null, code);
  await db.adminTotpAttempt.create({ data: { userId, success: step !== null, createdAt: now() } });
  if (step === null) return { ok: false, error: 'INVALID' };
  const backupCodes = newBackupCodes();
  await db.adminTotp.update({
    where: { userId },
    data: {
      enabledAt: now(),
      lastTimeStep: step,
      backupHashes: backupCodes.map((c) => sha256(normalizeBackup(c))),
    },
  });
  return { ok: true, backupCodes };
}

// Nhập mã 6 số (hoặc mã dự phòng) cho phiên admin. Sai 5 lần liên tiếp thì khoá 15 phút.
export async function verifyTotp(userId: string, code: string): Promise<VerifyResult> {
  const row = await db.adminTotp.findUnique({ where: { userId } });
  if (!row?.enabledAt) return { ok: false, error: 'NOT_SET_UP' };
  const until = await lockedUntil(userId);
  if (until) return { ok: false, error: 'LOCKED', until };

  const step = await checkCode(row.secretEnc, row.lastTimeStep, code);
  if (step !== null) {
    // Ghi time step đã dùng có điều kiện: 2 request cùng mã chỉ 1 cái qua.
    const used = await db.adminTotp.updateMany({
      where: { userId, OR: [{ lastTimeStep: null }, { lastTimeStep: { lt: step } }] },
      data: { lastTimeStep: step },
    });
    await db.adminTotpAttempt.create({ data: { userId, success: used.count === 1, createdAt: now() } });
    return used.count === 1 ? { ok: true } : { ok: false, error: 'INVALID' };
  }

  const hash = sha256(normalizeBackup(code));
  const match = row.backupHashes.find(
    (h) => h.length === hash.length && timingSafeEqual(Buffer.from(h), Buffer.from(hash)),
  );
  if (match) {
    const remaining = row.backupHashes.filter((h) => h !== match);
    const used = await db.adminTotp.updateMany({
      where: { userId, backupHashes: { has: match } },
      data: { backupHashes: remaining },
    });
    await db.adminTotpAttempt.create({ data: { userId, success: used.count === 1, createdAt: now() } });
    return used.count === 1 ? { ok: true, usedBackup: true } : { ok: false, error: 'INVALID' };
  }

  await db.adminTotpAttempt.create({ data: { userId, success: false, createdAt: now() } });
  return { ok: false, error: 'INVALID' };
}

export async function backupCodesLeft(userId: string): Promise<number> {
  return (await db.adminTotp.findUnique({ where: { userId } }))?.backupHashes.length ?? 0;
}
