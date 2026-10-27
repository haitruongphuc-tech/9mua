import type { LiveSession } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getIntSetting } from '@/lib/settings';
import { getKiotByOwner, getProductForCheckout, isKiotActive } from '@/modules/kiot';
import { runLiveEndedHooks } from './hooks';
import { mediaServer } from './media';
import { newMediaPath, newPublishToken, sha256 } from './tokens';

export const MIN_ACCOUNT_AGE_MS = 3 * 86_400_000;
export const PUBLISH_TOKEN_TTL_MS = 2 * 60_000;
export const NO_MEDIA_END_MS = 60_000;
export const MAX_TITLE = 100;
export const OPEN = ['created', 'live'];

export type StartError = 'ACCOUNT_TOO_NEW' | 'LIVE_FULL' | 'ALREADY_LIVE' | 'LIVE_BANNED' | 'INVALID_INPUT';

export async function activeLiveBan(userId: string, at = now()) {
  return db.liveBan.findFirst({
    where: { userId, OR: [{ until: null }, { until: { gt: at } }] },
    orderBy: { createdAt: 'desc' },
  });
}

// Sản phẩm ghim được: của bất kỳ Kiot đang hoạt động nào, đang bán và còn hàng (SPEC-live.md mục 7).
export async function pinnable(productId: string): Promise<boolean> {
  const p = await getProductForCheckout(productId);
  return Boolean(p?.available && p.stock > 0);
}

// Bắt đầu live (SPEC-live.md mục 1–3): kiểm tra luật, tạo buổi ở trạng thái "created" và trả mã phát dùng một lần.
// Buổi chỉ chuyển "live" khi máy chủ hình báo đã nhận được hình (syncWithMediaServer).
export async function startLive(
  userId: string,
  input: { title: string; pinProductId?: string | null },
): Promise<
  { ok: true; liveId: string; whipUrl: string; publishToken: string } | { ok: false; error: StartError }
> {
  const title = input.title.trim().replace(/\s+/g, ' ');
  if (!title || title.length > MAX_TITLE) return { ok: false, error: 'INVALID_INPUT' };
  if (input.pinProductId && !(await pinnable(input.pinProductId)))
    return { ok: false, error: 'INVALID_INPUT' };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, lockedAt: true },
  });
  if (!user || user.lockedAt) return { ok: false, error: 'LIVE_BANNED' };
  if (await activeLiveBan(userId)) return { ok: false, error: 'LIVE_BANNED' };
  if (now().getTime() - user.createdAt.getTime() < MIN_ACCOUNT_AGE_MS)
    return { ok: false, error: 'ACCOUNT_TOO_NEW' };
  const kiot = await getKiotByOwner(userId);
  const maxSessions = await getIntSetting('live_max_sessions');
  const { token, hash } = newPublishToken();
  const mediaPath = newMediaPath();

  const result = await db.$transaction(async (tx) => {
    // Khoá chung: hai người bấm cùng lúc không vượt số buổi tối đa.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('live:start'))`;
    if (await tx.liveSession.count({ where: { hostUserId: userId, status: { in: OPEN } } }))
      return { ok: false as const, error: 'ALREADY_LIVE' as const };
    if ((await tx.liveSession.count({ where: { status: { in: OPEN } } })) >= maxSessions)
      return { ok: false as const, error: 'LIVE_FULL' as const };
    const at = now();
    const live = await tx.liveSession.create({
      data: {
        hostUserId: userId,
        kiotId: kiot && isKiotActive(kiot) ? kiot.id : null,
        title,
        mediaPath,
        publishTokenHash: hash,
        publishExpiresAt: new Date(at.getTime() + PUBLISH_TOKEN_TTL_MS),
        pinnedProductId: input.pinProductId ?? null,
        createdAt: at,
      },
    });
    return { ok: true as const, liveId: live.id };
  });
  if (!result.ok) return result;
  return { ok: true, liveId: result.liveId, whipUrl: mediaServer().whipUrl(mediaPath), publishToken: token };
}

// Kết thúc 1 lần duy nhất (người phát bấm, CEO dừng, hết giờ, mất hình): ngắt kết nối phía máy chủ hình, chạy hook
// (xét thưởng xu, báo người phát).
export async function finishLive(
  liveId: string,
  status: 'ended' | 'stopped',
  reason: string,
): Promise<boolean> {
  const { count } = await db.liveSession.updateMany({
    where: { id: liveId, status: { in: OPEN } },
    data: { status, endedAt: now(), endReason: reason.slice(0, 300) },
  });
  if (count !== 1) return false;
  const live = await db.liveSession.findUniqueOrThrow({ where: { id: liveId } });
  await mediaServer()
    .kick(live.mediaPath)
    .catch((e) =>
      console.error('[live] không ngắt được kết nối MediaMTX:', e instanceof Error ? e.message : e),
    );
  await runLiveEndedHooks(live);
  return true;
}

export async function endLive(liveId: string, userId: string): Promise<{ ok: boolean }> {
  const live = await db.liveSession.findUnique({ where: { id: liveId } });
  if (!live || live.hostUserId !== userId) return { ok: false };
  await finishLive(liveId, 'ended', 'host');
  return { ok: true };
}

export function myOpenLive(userId: string): Promise<LiveSession | null> {
  return db.liveSession.findFirst({ where: { hostUserId: userId, status: { in: OPEN } } });
}

export async function getLive(liveId: string): Promise<LiveSession | null> {
  return db.liveSession.findUnique({ where: { id: liveId } });
}

export function hashPublishToken(token: string): string {
  return sha256(token);
}
