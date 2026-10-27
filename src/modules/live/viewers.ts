import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getIntSetting } from '@/lib/settings';
import { mediaServer } from './media';
import {
  finishLive,
  getLive,
  hashPublishToken,
  NO_MEDIA_END_MS,
  OPEN,
  PUBLISH_TOKEN_TTL_MS,
} from './session';
import { networkHash, signViewToken, verifyViewToken } from './tokens';

// Đếm người xem thật (SPEC-live.md "Đếm người xem"): trình duyệt gửi tín hiệu mỗi 20 giây khi video đang phát;
// "đang xem" là có tín hiệu trong 45 giây gần nhất. Không bao giờ hiện số giả.
export const HEARTBEAT_MS = 20_000;
export const ACTIVE_WINDOW_MS = 45_000;

export type Viewer = { userId?: string | null; anonId?: string | null };

export function viewerKey(v: Viewer): string | null {
  if (v.userId) return `u:${v.userId}`;
  if (v.anonId && /^[\w-]{8,64}$/.test(v.anonId)) return `a:${v.anonId}`;
  return null;
}

export async function activeViewers(liveId: string, exceptKey?: string): Promise<number> {
  return db.liveViewer.count({
    where: {
      liveId,
      lastSeenAt: { gte: new Date(now().getTime() - ACTIVE_WINDOW_MS) },
      ...(exceptKey ? { viewerKey: { not: exceptKey } } : {}),
    },
  });
}

export async function heartbeat(
  liveId: string,
  viewer: Viewer,
  ip: string,
): Promise<{ viewers: number } | null> {
  const key = viewerKey(viewer);
  const live = await getLive(liveId);
  if (!key || !live || live.status !== 'live') return null;
  if (viewer.userId && viewer.userId === live.hostUserId) return { viewers: await activeViewers(liveId) };
  const at = now();
  const existing = await db.liveViewer.findUnique({
    where: { liveId_viewerKey: { liveId, viewerKey: key } },
  });
  if (!existing) {
    await db.liveViewer
      .create({
        data: {
          liveId,
          viewerKey: key,
          userId: viewer.userId ?? null,
          networkHash: networkHash(ip),
          firstSeenAt: at,
          lastSeenAt: at,
          streakStartAt: at,
        },
      })
      .catch(() => null); // 2 tín hiệu đến cùng lúc: bản kia đã tạo
  } else {
    // Tín hiệu cách nhau quá 45 giây thì chuỗi xem liên tục tính lại từ đầu (luật người xem hợp lệ của xu).
    const continuous = at.getTime() - existing.lastSeenAt.getTime() <= ACTIVE_WINDOW_MS;
    const streakStart = continuous ? existing.streakStartAt : at;
    const streak = Math.floor((at.getTime() - streakStart.getTime()) / 1000);
    await db.liveViewer.update({
      where: { liveId_viewerKey: { liveId, viewerKey: key } },
      data: {
        lastSeenAt: at,
        streakStartAt: streakStart,
        longestStreakSec: Math.max(existing.longestStreakSec, streak),
      },
    });
  }
  const viewers = await activeViewers(liveId);
  await db.liveSession.updateMany({
    where: { id: liveId, peakViewers: { lt: viewers } },
    data: { peakViewers: viewers },
  });
  return { viewers };
}

// MediaMTX hỏi trước mỗi kết nối phát/xem (authMethod: http). Phát: đúng mã phát của đúng buổi, chưa hết hạn, dùng
// một lần. Xem: mã xem ký HMAC còn hạn, buổi đang mở, chưa đủ số người xem.
export async function authorizeMedia(req: { action: string; path: string; token: string }): Promise<boolean> {
  const live = await db.liveSession.findUnique({ where: { mediaPath: req.path } });
  if (!live || !OPEN.includes(live.status) || !req.token) return false;
  const at = now();
  if (req.action === 'publish') {
    if (hashPublishToken(req.token) !== live.publishTokenHash) return false;
    if (live.publishUsedAt) {
      // Cho nối lại khi mất sóng trong lúc đang live (cùng mã), chặn sau khi buổi đã kết thúc (ở trên).
      return live.status === 'live';
    }
    if (live.publishExpiresAt <= at) return false;
    const { count } = await db.liveSession.updateMany({
      where: { id: live.id, publishUsedAt: null },
      data: { publishUsedAt: at },
    });
    return count === 1;
  }
  if (req.action === 'read') {
    const v = verifyViewToken(req.token, at.getTime());
    if (!v || v.liveId !== live.id) return false;
    return (await activeViewers(live.id, v.viewerKey)) < (await getIntSetting('live_max_viewers'));
  }
  return false;
}

export function viewToken(liveId: string, key: string): string {
  return signViewToken(liveId, key, now().getTime());
}

// Worker gọi mỗi 5 giây: có hình thì "live"; mất hình quá 60 giây, quá 2 giờ, hoặc mã phát hết hạn mà chưa có hình
// thì kết thúc (SPEC-live.md "Trạng thái buổi live"). Máy chủ hình không trả lời thì vẫn huỷ buổi chưa từng có
// hình và buổi quá 2 giờ (không để chiếm chỗ), giữ nguyên buổi đang live, rồi báo lỗi cho worker ghi log.
export async function syncWithMediaServer(
  server = mediaServer(),
): Promise<{ started: number; ended: number }> {
  const sessions = await db.liveSession.findMany({ where: { status: { in: OPEN } } });
  if (sessions.length === 0) return { started: 0, ended: 0 };
  let ready: Set<string> | null = null;
  let failure: unknown = null;
  try {
    ready = await server.readyPaths();
  } catch (e) {
    failure = e;
  }
  const maxMs = (await getIntSetting('live_max_minutes')) * 60_000;
  const at = now();
  let started = 0;
  let ended = 0;
  for (const s of sessions) {
    if (!ready) {
      const reason =
        s.status === 'live'
          ? s.startedAt && at.getTime() - s.startedAt.getTime() >= maxMs && 'time_limit'
          : at.getTime() - s.createdAt.getTime() > PUBLISH_TOKEN_TTL_MS + NO_MEDIA_END_MS && 'never_started';
      if (reason && (await finishLive(s.id, 'ended', reason))) ended += 1;
      continue;
    }
    const hasMedia = ready.has(s.mediaPath);
    if (hasMedia) {
      if (s.status === 'created') started += 1;
      await db.liveSession.update({
        where: { id: s.id },
        data: { status: 'live', startedAt: s.startedAt ?? at, lastMediaAt: at },
      });
      if (s.startedAt && at.getTime() - s.startedAt.getTime() >= maxMs) {
        if (await finishLive(s.id, 'ended', 'time_limit')) ended += 1;
      }
      continue;
    }
    const lastSeen = (s.lastMediaAt ?? s.publishUsedAt ?? s.createdAt).getTime();
    const tooLongWithoutMedia =
      s.status === 'live'
        ? at.getTime() - lastSeen > NO_MEDIA_END_MS
        : at.getTime() - s.createdAt.getTime() > PUBLISH_TOKEN_TTL_MS + NO_MEDIA_END_MS;
    if (
      tooLongWithoutMedia &&
      (await finishLive(s.id, 'ended', s.status === 'live' ? 'no_media' : 'never_started'))
    )
      ended += 1;
  }
  if (failure) throw failure;
  return { started, ended };
}
