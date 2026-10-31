import { randomBytes } from 'node:crypto';
import { notBlockedWith } from '@/lib/blocks';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processCroppedImage } from '@/lib/media/process-image';
import { notifyEvent } from '@/lib/notify-events';
import { PROVINCES } from '@/modules/kiot';
import { Prisma } from '@prisma/client';

// Sự kiện (SPEC-social.md V5.7 mục 1, công tắc events): chủ Kiot / creator tạo; người xem "Quan tâm" nhận thông báo 1 giờ
// trước giờ bắt đầu. Mỗi người tối đa 10 sự kiện sắp diễn ra.
export const MAX_EVENT_TITLE = 80;
export const MAX_EVENT_ADDRESS = 120;
export const MAX_EVENT_DESCRIPTION = 1000;
export const MAX_EVENT_PRODUCTS = 6;
export const MAX_UPCOMING_EVENTS = 10;
export const EVENT_AUTO_HIDE_REPORTERS = 5;
const REMIND_BEFORE_MS = 3_600_000;

export type EventInput = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  mode: string; // live | place
  province?: string | null;
  address?: string | null;
  description?: string;
  productIds?: string[];
};

export type EventCard = {
  id: string;
  title: string;
  coverPath: string | null;
  startsAt: Date;
  endsAt: Date;
  mode: 'live' | 'place';
  province: string | null;
  address: string | null;
  ownerId: string;
  ownerName: string;
  interested: number;
};

export type EventError = 'INVALID' | 'TIME_INVALID' | 'PLACE_INVALID' | 'HAS_LINK' | 'LIMIT' | 'NOT_FOUND';

function clean(
  input: EventInput,
):
  | { ok: true; data: Omit<EventInput, 'productIds'> & { productIds: string[] } }
  | { ok: false; error: EventError } {
  const title = input.title.replace(/\s+/g, ' ').trim();
  const description = (input.description ?? '').trim();
  const address = (input.address ?? '').replace(/\s+/g, ' ').trim() || null;
  if (!title || title.length > MAX_EVENT_TITLE || description.length > MAX_EVENT_DESCRIPTION)
    return { ok: false, error: 'INVALID' };
  if (hasLink(title) || hasLink(description)) return { ok: false, error: 'HAS_LINK' };
  if (input.mode !== 'live' && input.mode !== 'place') return { ok: false, error: 'INVALID' };
  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < now().getTime())
    return { ok: false, error: 'TIME_INVALID' };
  const province = input.province?.trim() || null;
  if (province && !PROVINCES.some((p) => p.slug === province)) return { ok: false, error: 'PLACE_INVALID' };
  if (input.mode === 'place' && (!province || !address)) return { ok: false, error: 'PLACE_INVALID' };
  if (address && address.length > MAX_EVENT_ADDRESS) return { ok: false, error: 'PLACE_INVALID' };
  const productIds = [...new Set((input.productIds ?? []).filter(Boolean))];
  if (productIds.length > MAX_EVENT_PRODUCTS) return { ok: false, error: 'INVALID' };
  return { ok: true, data: { ...input, title, description, address, province, productIds } };
}

export async function createEvent(
  userId: string,
  input: EventInput,
): Promise<{ ok: true; eventId: string } | { ok: false; error: EventError }> {
  const c = clean(input);
  if (!c.ok) return c;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`event:${userId}`}))`;
    const upcoming = await tx.event.count({
      where: { ownerId: userId, status: 'active', endsAt: { gt: now() } },
    });
    if (upcoming >= MAX_UPCOMING_EVENTS) return { ok: false as const, error: 'LIMIT' as const };
    const t = now();
    const e = await tx.event.create({
      data: {
        ownerId: userId,
        title: c.data.title,
        startsAt: c.data.startsAt,
        endsAt: c.data.endsAt,
        mode: c.data.mode,
        province: c.data.province ?? null,
        address: c.data.address ?? null,
        description: c.data.description ?? '',
        productIds: c.data.productIds,
        createdAt: t,
        updatedAt: t,
      },
    });
    return { ok: true as const, eventId: e.id };
  });
}

export async function cancelEvent(userId: string, eventId: string): Promise<boolean> {
  const r = await db.event.updateMany({
    where: { id: eventId, ownerId: userId, status: 'active' },
    data: { status: 'cancelled', updatedAt: now() },
  });
  return r.count > 0;
}

// Ảnh bìa sự kiện 16:9 (1200×675 WebP).
export async function setEventCover(
  userId: string,
  eventId: string,
  image: Buffer,
): Promise<{ ok: boolean }> {
  const e = await db.event.findFirst({ where: { id: eventId, ownerId: userId } });
  if (!e) return { ok: false };
  const p = await processCroppedImage(image, { width: 1200, height: 675 });
  if (!p.ok) return { ok: false };
  const coverPath = await imageStore().save(`events/${e.id}-${randomBytes(6).toString('hex')}.webp`, p.data);
  await db.event.update({ where: { id: e.id }, data: { coverPath, updatedAt: now() } });
  if (e.coverPath)
    await imageStore()
      .remove(e.coverPath)
      .catch(() => {});
  return { ok: true };
}

type CardRow = Omit<EventCard, 'mode'> & { mode: string };
const toCard = (r: CardRow): EventCard => ({ ...r, mode: r.mode === 'live' ? 'live' : 'place' });

// /su-kien: sắp diễn ra (chưa kết thúc), lọc theo tỉnh; ownerId: khối Sự kiện trên trang Kiot / trang cá nhân.
export async function upcomingEvents(
  viewerId: string | undefined,
  filter: { province?: string | null; ownerId?: string } = {},
  take = 50,
): Promise<EventCard[]> {
  const rows = await db.$queryRaw<CardRow[]>`
    SELECT e.id, e.title, e."coverPath", e."startsAt", e."endsAt", e.mode, e.province, e.address, e."ownerId",
      u."displayName" AS "ownerName",
      (SELECT count(*)::int FROM "EventInterest" i WHERE i."eventId" = e.id) AS interested
    FROM "Event" e JOIN "User" u ON u.id = e."ownerId"
    WHERE e.status = 'active' AND e."endsAt" > ${now()} AND u."lockedAt" IS NULL
      AND ${notBlockedWith(viewerId, Prisma.sql`e."ownerId"`)}
      ${filter.province ? Prisma.sql`AND e.province = ${filter.province}` : Prisma.empty}
      ${filter.ownerId ? Prisma.sql`AND e."ownerId" = ${filter.ownerId}` : Prisma.empty}
    ORDER BY e."startsAt" ASC LIMIT ${take}`;
  return rows.map(toCard);
}

export async function eventPage(
  eventId: string,
  viewerId: string | undefined,
): Promise<
  (EventCard & { description: string; productIds: string[]; status: string; interestedByMe: boolean }) | null
> {
  const rows = await db.$queryRaw<
    (CardRow & { description: string; productIds: string[]; status: string })[]
  >`
    SELECT e.id, e.title, e."coverPath", e."startsAt", e."endsAt", e.mode, e.province, e.address, e."ownerId",
      e.description, e."productIds", e.status, u."displayName" AS "ownerName",
      (SELECT count(*)::int FROM "EventInterest" i WHERE i."eventId" = e.id) AS interested
    FROM "Event" e JOIN "User" u ON u.id = e."ownerId"
    WHERE e.id = ${eventId} AND u."lockedAt" IS NULL AND ${notBlockedWith(viewerId, Prisma.sql`e."ownerId"`)}`;
  const r = rows[0];
  if (!r || (r.status === 'removed' && r.ownerId !== viewerId)) return null;
  const mine = viewerId
    ? await db.eventInterest.findUnique({ where: { userId_eventId: { userId: viewerId, eventId } } })
    : null;
  return {
    ...toCard(r),
    description: r.description,
    productIds: r.productIds,
    status: r.status,
    interestedByMe: Boolean(mine),
  };
}

export async function toggleEventInterest(
  userId: string,
  eventId: string,
): Promise<{ ok: boolean; interested: boolean }> {
  const e = await db.event.findFirst({ where: { id: eventId, status: 'active', endsAt: { gt: now() } } });
  if (!e) return { ok: false, interested: false };
  const key = { userId_eventId: { userId, eventId } };
  if (await db.eventInterest.findUnique({ where: key })) {
    await db.eventInterest.delete({ where: key });
    return { ok: true, interested: false };
  }
  await db.eventInterest.create({ data: { userId, eventId, createdAt: now() } });
  return { ok: true, interested: true };
}

// Việc định kỳ (5 phút): báo người "Quan tâm" khi sự kiện còn ≤ 1 giờ nữa bắt đầu; mỗi sự kiện báo một lần.
export async function remindEvents(): Promise<number> {
  const t = now();
  const due = await db.event.findMany({
    where: {
      status: 'active',
      reminderSentAt: null,
      startsAt: { gt: t, lte: new Date(t.getTime() + REMIND_BEFORE_MS) },
    },
    take: 100,
  });
  let sent = 0;
  for (const e of due) {
    const claimed = await db.event.updateMany({
      where: { id: e.id, reminderSentAt: null },
      data: { reminderSentAt: t },
    });
    if (!claimed.count) continue;
    const people = await db.eventInterest.findMany({ where: { eventId: e.id }, select: { userId: true } });
    for (const p of people) {
      await notifyEvent({
        userId: p.userId,
        type: 'event',
        key: 'notify.eventSoon',
        vars: { detail: e.title },
        url: `/su-kien/${e.id}`,
      });
      sent += 1;
    }
  }
  return sent;
}

// Báo cáo như video: 5 người báo cáo thì tự ẩn chờ CEO xem.
export async function reportEvent(userId: string, eventId: string, reason: string): Promise<boolean> {
  const e = await db.event.findUnique({ where: { id: eventId } });
  if (!e || e.ownerId === userId) return false;
  await db.eventReport.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, reason: reason.slice(0, 50), createdAt: now() },
    update: {},
  });
  if ((await db.eventReport.count({ where: { eventId, status: 'open' } })) >= EVENT_AUTO_HIDE_REPORTERS)
    await db.event.updateMany({
      where: { id: eventId, status: 'active' },
      data: { status: 'removed', updatedAt: now() },
    });
  return true;
}

export async function listEventReports() {
  const reports = await db.eventReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const ids = [...new Set(reports.map((r) => r.eventId))];
  const events = await db.event.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, status: true },
  });
  return ids.map((id) => ({
    event: events.find((e) => e.id === id) ?? null,
    count: reports.filter((r) => r.eventId === id).length,
  }));
}

export async function resolveEventReports(eventId: string, action: 'remove' | 'dismiss'): Promise<boolean> {
  const e = await db.event.findUnique({ where: { id: eventId } });
  if (!e) return false;
  await db.$transaction([
    db.eventReport.updateMany({
      where: { eventId, status: 'open' },
      data: { status: action === 'remove' ? 'actioned' : 'dismissed' },
    }),
    db.event.update({
      where: { id: eventId },
      data:
        action === 'remove'
          ? { status: 'removed', updatedAt: now() }
          : e.status === 'removed'
            ? { status: 'active', updatedAt: now() }
            : {},
    }),
  ]);
  return true;
}
