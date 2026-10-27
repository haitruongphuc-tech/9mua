import { db } from '@/lib/db';
import { getIntSetting } from '@/lib/settings';
import { kiotOrigin } from '@/lib/urls';
import { getProductForCheckout, kiotBasics, productPath } from '@/modules/kiot';
import { mediaServer } from './media';
import { getLive } from './session';
import { activeViewers, viewerKey, viewToken, type Viewer } from './viewers';

// Dữ liệu cho trang xem live (SPEC-live.md mục 4) và luồng SSE (chat, tim, người xem, sản phẩm ghim).
export type LiveHost = {
  id: string;
  displayName: string;
  href: string; // Kiot của người phát (nếu có), không thì trang creator
  kiot: { slug: string; name: string; logoUrl: string | null } | null;
};
export type PinnedCard = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  url: string;
};
export type ChatLine = { id: string; userId: string; name: string; text: string; host: boolean; at: string };

export type LiveCard = { id: string; title: string; host: LiveHost; viewers: number; startedAt: Date | null };

async function hostsOf(
  lives: { hostUserId: string; kiotId: string | null }[],
): Promise<Map<string, LiveHost>> {
  const [users, kiots] = await Promise.all([
    db.user.findMany({
      where: { id: { in: lives.map((l) => l.hostUserId) } },
      select: { id: true, displayName: true },
    }),
    kiotBasics(lives.map((l) => l.kiotId).filter((k): k is string => Boolean(k))),
  ]);
  const map = new Map<string, LiveHost>();
  for (const l of lives) {
    const u = users.find((x) => x.id === l.hostUserId);
    const k = kiots.find((x) => x.id === l.kiotId);
    map.set(l.hostUserId, {
      id: l.hostUserId,
      displayName: u?.displayName ?? '',
      href: k ? kiotOrigin(k.slug) : `/creator/${l.hostUserId}`,
      kiot: k ? { slug: k.slug, name: k.name, logoUrl: k.logoUrl } : null,
    });
  }
  return map;
}

// Buổi đang live và không bị ẩn do báo cáo, mới nhất trước.
export async function listLiveNow(): Promise<LiveCard[]> {
  const lives = await db.liveSession.findMany({
    where: { status: 'live', hiddenAt: null },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  const hosts = await hostsOf(lives);
  return Promise.all(
    lives.map(async (l) => ({
      id: l.id,
      title: l.title,
      host: hosts.get(l.hostUserId)!,
      viewers: await activeViewers(l.id),
      startedAt: l.startedAt,
    })),
  );
}

// Người đang live (cho nhãn LIVE ở trang Kiot / creator và chấm đỏ thanh dưới).
export async function liveIdOfHost(userId: string): Promise<string | null> {
  return (
    (await db.liveSession.findFirst({ where: { hostUserId: userId, status: 'live' }, select: { id: true } }))
      ?.id ?? null
  );
}

export async function anyLiveNow(): Promise<boolean> {
  return (await db.liveSession.count({ where: { status: 'live', hiddenAt: null } })) > 0;
}

export async function pinnedCard(productId: string | null): Promise<PinnedCard | null> {
  if (!productId) return null;
  const p = await getProductForCheckout(productId);
  if (!p?.available || p.stock <= 0) return null; // hết hàng hoặc bị ẩn thì thẻ tự ẩn
  const [k] = await kiotBasics([p.kiotId]);
  if (!k) return null;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    url: `${kiotOrigin(k.slug)}${productPath(p)}`,
  };
}

export async function recentChat(liveId: string, afterId?: string | null, take = 50): Promise<ChatLine[]> {
  const live = await getLive(liveId);
  if (!live) return [];
  const after = afterId
    ? await db.liveChatMessage.findUnique({ where: { id: afterId }, select: { createdAt: true } })
    : null;
  const rows = await db.liveChatMessage.findMany({
    where: { liveId, hiddenAt: null, ...(after ? { createdAt: { gt: after.createdAt } } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, displayName: true },
  });
  return rows.reverse().map((r) => ({
    id: r.id,
    userId: r.userId,
    name: users.find((u) => u.id === r.userId)?.displayName ?? '',
    text: r.text,
    host: r.userId === live.hostUserId,
    at: r.createdAt.toISOString(),
  }));
}

export type LiveState = {
  status: string;
  viewers: number;
  hearts: number;
  pinned: PinnedCard | null;
  hiddenIds: string[];
};

// Trạng thái gọn cho SSE (gửi khi có thay đổi).
export async function liveState(liveId: string): Promise<LiveState | null> {
  const live = await getLive(liveId);
  if (!live) return null;
  const hidden = await db.liveChatMessage.findMany({
    where: { liveId, hiddenAt: { not: null } },
    select: { id: true },
    orderBy: { hiddenAt: 'desc' },
    take: 50,
  });
  return {
    status: live.status,
    viewers: await activeViewers(liveId),
    hearts: live.hearts,
    pinned: await pinnedCard(live.pinnedProductId),
    hiddenIds: hidden.map((h) => h.id),
  };
}

export type LiveView =
  | {
      kind: 'live';
      id: string;
      title: string;
      status: string;
      host: LiveHost;
      isHost: boolean;
      viewers: number;
      hearts: number;
      pinned: PinnedCard | null;
      chat: ChatLine[];
      whepUrl: string;
      viewToken: string | null;
      startedAt: string | null;
    }
  | { kind: 'full'; id: string }
  | { kind: 'ended'; id: string; title: string; host: LiveHost };

export async function getLiveForViewer(liveId: string, viewer: Viewer): Promise<LiveView | null> {
  const live = await getLive(liveId);
  if (!live) return null;
  const host = (await hostsOf([live])).get(live.hostUserId)!;
  if (live.status === 'ended' || live.status === 'stopped')
    return { kind: 'ended', id: live.id, title: live.title, host };
  const key = viewerKey(viewer);
  const isHost = Boolean(viewer.userId && viewer.userId === live.hostUserId);
  const viewers = await activeViewers(live.id);
  if (
    !isHost &&
    (await activeViewers(live.id, key ?? undefined)) >= (await getIntSetting('live_max_viewers'))
  )
    return { kind: 'full', id: live.id };
  return {
    kind: 'live',
    id: live.id,
    title: live.title,
    status: live.status,
    host,
    isHost,
    viewers,
    hearts: live.hearts,
    pinned: await pinnedCard(live.pinnedProductId),
    chat: await recentChat(live.id),
    whepUrl: mediaServer().whepUrl(live.mediaPath),
    viewToken: key ? viewToken(live.id, key) : null,
    startedAt: live.startedAt?.toISOString() ?? null,
  };
}

// Bảng tổng kết cho người phát sau khi kết thúc (SPEC-live.md mục 3).
export async function liveSummary(liveId: string, userId: string) {
  const live = await getLive(liveId);
  if (!live || live.hostUserId !== userId) return null;
  const durationSec =
    live.startedAt && live.endedAt
      ? Math.max(0, Math.round((live.endedAt.getTime() - live.startedAt.getTime()) / 1000))
      : 0;
  return {
    status: live.status,
    durationSec,
    peakViewers: live.peakViewers,
    hearts: live.hearts,
    endReason: live.endReason,
  };
}
