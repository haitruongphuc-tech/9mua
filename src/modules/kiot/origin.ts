import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { readPrivate, savePrivate } from '@/lib/media/private-store';
import { processImage } from '@/lib/media/process-image';
import { runTool } from '@/lib/media/run-tool';
import { notifyKey } from '@/lib/notifications';

// Hồ sơ nguồn gốc + huy hiệu (SPEC-kiot.md V5.2, công tắc origin). File lưu ở PRIVATE_DIR như ảnh CCCD, chỉ admin xem qua
// route có kiểm quyền. Hồ sơ duyệt có hạn 12 tháng; nhắc gia hạn trước 30 ngày.
export const ORIGIN_VALID_DAYS = 365;
export const ORIGIN_MAX_BYTES = 10 * 1024 * 1024;
export const ORIGIN_VIDEO_MAX_BYTES = 60 * 1024 * 1024;
export const ORIGIN_VIDEO_MAX_SEC = 60;
const DAY = 86_400_000;

export type OriginFileKind = 'invoice' | 'certificate' | 'photo' | 'video';
export type OriginUpload = { kind: 'invoice' | 'certificate'; data: Buffer };
export type OriginError =
  | 'NO_KIOT'
  | 'PENDING'
  | 'NEED_DOCUMENT'
  | 'NEED_PHOTOS'
  | 'TOO_MANY_PHOTOS'
  | 'NEED_COMMIT'
  | 'FILE_INVALID'
  | 'VIDEO_INVALID';

const isPdf = (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-';

async function videoSeconds(data: Buffer): Promise<number | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'origin-'));
  try {
    const file = path.join(dir, 'v');
    await writeFile(file, data);
    const { stdout } = await runTool(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
      30_000,
    );
    const sec = Number(stdout.trim());
    return Number.isFinite(sec) ? sec : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function submitOrigin(
  ownerId: string,
  input: {
    documents: OriginUpload[];
    photos: Buffer[];
    video?: Buffer | null;
    commitOrigin: boolean;
    commitRefund: boolean;
  },
): Promise<{ ok: true; dossierId: string } | { ok: false; error: OriginError }> {
  const kiot = await db.kiot.findUnique({ where: { ownerId }, select: { id: true } });
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  if (await db.originDossier.findFirst({ where: { kiotId: kiot.id, status: 'pending' } }))
    return { ok: false, error: 'PENDING' };
  if (!input.documents.length) return { ok: false, error: 'NEED_DOCUMENT' };
  if (input.photos.length < 3) return { ok: false, error: 'NEED_PHOTOS' };
  if (input.photos.length > 6) return { ok: false, error: 'TOO_MANY_PHOTOS' };
  if (!input.commitOrigin || !input.commitRefund) return { ok: false, error: 'NEED_COMMIT' };

  const dir = `origin/${kiot.id}/${randomBytes(8).toString('hex')}`;
  const files: { kind: OriginFileKind; path: string; bytes: number }[] = [];
  let n = 0;
  for (const d of input.documents.slice(0, 6)) {
    if (d.data.length > ORIGIN_MAX_BYTES) return { ok: false, error: 'FILE_INVALID' };
    n += 1;
    if (isPdf(d.data)) {
      files.push({ kind: d.kind, path: await savePrivate(`${dir}/${n}.pdf`, d.data), bytes: d.data.length });
      continue;
    }
    const p = await processImage(d.data);
    if (!p.ok) return { ok: false, error: 'FILE_INVALID' };
    files.push({ kind: d.kind, path: await savePrivate(`${dir}/${n}.webp`, p.main), bytes: p.main.length });
  }
  for (const photo of input.photos) {
    if (photo.length > ORIGIN_MAX_BYTES) return { ok: false, error: 'FILE_INVALID' };
    const p = await processImage(photo);
    if (!p.ok) return { ok: false, error: 'FILE_INVALID' };
    n += 1;
    files.push({ kind: 'photo', path: await savePrivate(`${dir}/${n}.webp`, p.main), bytes: p.main.length });
  }
  if (input.video && input.video.length) {
    if (input.video.length > ORIGIN_VIDEO_MAX_BYTES) return { ok: false, error: 'VIDEO_INVALID' };
    const sec = await videoSeconds(input.video);
    if (sec === null || sec > ORIGIN_VIDEO_MAX_SEC + 0.5) return { ok: false, error: 'VIDEO_INVALID' };
    files.push({
      kind: 'video',
      path: await savePrivate(`${dir}/video`, input.video),
      bytes: input.video.length,
    });
  }
  const t = now();
  const dossier = await db.originDossier.create({
    data: { kiotId: kiot.id, status: 'pending', commitAt: t, createdAt: t, files: { create: files } },
  });
  return { ok: true, dossierId: dossier.id };
}

// Hồ sơ mới nhất của Kiot (trang /kiot-cua-toi/nguon-goc).
export async function latestOrigin(kiotId: string) {
  return db.originDossier.findFirst({
    where: { kiotId },
    orderBy: { createdAt: 'desc' },
    include: { files: { select: { id: true, kind: true, bytes: true } } },
  });
}

export async function listOriginQueue() {
  const rows = await db.originDossier.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: {
      files: { select: { id: true, kind: true, bytes: true } },
      kiot: { select: { name: true, slug: true } },
    },
    take: 100,
  });
  return rows;
}

// CEO duyệt / từ chối (kèm lý do) / thu hồi (kèm lý do).
export async function reviewOrigin(
  adminId: string,
  dossierId: string,
  decision: 'approve' | 'reject' | 'revoke',
  reason = '',
): Promise<boolean> {
  const d = await db.originDossier.findUnique({
    where: { id: dossierId },
    include: { kiot: { select: { ownerId: true } } },
  });
  if (!d) return false;
  const t = now();
  if (decision === 'revoke') {
    if (d.status !== 'approved' || !reason.trim()) return false;
    await db.originDossier.update({
      where: { id: d.id },
      data: { status: 'revoked', reason: reason.slice(0, 300), reviewedBy: adminId, reviewedAt: t },
    });
  } else {
    if (d.status !== 'pending' || (decision === 'reject' && !reason.trim())) return false;
    await db.originDossier.update({
      where: { id: d.id },
      data:
        decision === 'approve'
          ? {
              status: 'approved',
              reviewedBy: adminId,
              reviewedAt: t,
              expiresAt: new Date(t.getTime() + ORIGIN_VALID_DAYS * DAY),
            }
          : { status: 'rejected', reason: reason.slice(0, 300), reviewedBy: adminId, reviewedAt: t },
    });
  }
  await notifyKey(
    d.kiot.ownerId,
    decision === 'approve'
      ? 'notify.originApproved'
      : decision === 'reject'
        ? 'notify.originRejected'
        : 'notify.originRevoked',
    { reason: reason.slice(0, 120) },
    '/kiot-cua-toi/nguon-goc',
  );
  return true;
}

// Admin xem file qua route có kiểm quyền.
export async function readOriginFile(
  fileId: string,
): Promise<{ data: Buffer; kind: OriginFileKind; pdf: boolean } | null> {
  const f = await db.originFile.findUnique({ where: { id: fileId } });
  if (!f) return null;
  const data = await readPrivate(f.path);
  return data ? { data, kind: f.kind as OriginFileKind, pdf: f.path.endsWith('.pdf') } : null;
}

// Hồ sơ đang có hiệu lực (duyệt, chưa hết hạn, chưa thu hồi).
async function activeOrigin(kiotId: string) {
  return db.originDossier.findFirst({
    where: { kiotId, status: 'approved', expiresAt: { gt: now() } },
    include: { files: { where: { kind: 'video' }, select: { id: true } } },
  });
}

export type KiotBadges = { origin: boolean; bank: boolean; video: boolean; level: 0 | 1 | 2 | 3 };

// Huy hiệu (SPEC-kiot.md V5.2 mục 4). bankVerified do tầng ứng dụng truyền vào (KYC + tên tài khoản khớp, module payouts).
export async function kiotBadges(kiotId: string, bankVerified: boolean): Promise<KiotBadges> {
  const o = await activeOrigin(kiotId);
  const origin = Boolean(o);
  const video = Boolean(o?.files.length);
  const level = [origin, bankVerified, video].filter(Boolean).length as 0 | 1 | 2 | 3;
  return { origin, bank: bankVerified, video, level };
}

// Việc hằng ngày: nhắc gia hạn trước 30 ngày (mỗi hồ sơ một lần).
export async function remindOriginRenewal(): Promise<number> {
  const t = now();
  const due = await db.originDossier.findMany({
    where: {
      status: 'approved',
      renewRemindedAt: null,
      expiresAt: { gt: t, lte: new Date(t.getTime() + 30 * DAY) },
    },
    include: { kiot: { select: { ownerId: true } } },
    take: 200,
  });
  let n = 0;
  for (const d of due) {
    const claimed = await db.originDossier.updateMany({
      where: { id: d.id, renewRemindedAt: null },
      data: { renewRemindedAt: t },
    });
    if (!claimed.count) continue;
    await notifyKey(d.kiot.ownerId, 'notify.originRenew', {}, '/kiot-cua-toi/nguon-goc');
    n += 1;
  }
  return n;
}

// Hồ sơ đang có hiệu lực (CEO thu hồi kèm lý do).
export async function listApprovedOrigins(take = 100) {
  return db.originDossier.findMany({
    where: { status: 'approved', expiresAt: { gt: now() } },
    orderBy: { reviewedAt: 'desc' },
    include: { kiot: { select: { name: true, slug: true } } },
    take,
  });
}
