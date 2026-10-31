import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { notifyEvent } from '@/lib/notify-events';
import { getKiotByOwner, isKiotActive } from '@/modules/kiot';

// Tài khoản riêng tư (SPEC-identity.md V5.2, công tắc account_more). Follow mới thành yêu cầu, lưu ở bảng FollowRequest
// riêng (bảng Follow giữ nguyên nghĩa "đang follow", nên mọi chỗ đếm / lọc follow cũ không phải đổi).
export async function setPrivateAccount(
  userId: string,
  on: boolean,
): Promise<{ ok: true } | { ok: false; error: 'KIOT_ACTIVE' }> {
  if (on) {
    // Chủ Kiot đang hoạt động không bật được: Kiot phải công khai để bán hàng.
    const kiot = await getKiotByOwner(userId);
    if (kiot && isKiotActive(kiot)) return { ok: false, error: 'KIOT_ACTIVE' };
    await db.user.update({ where: { id: userId }, data: { isPrivate: true } });
    return { ok: true };
  }
  // Tắt riêng tư: các yêu cầu đang chờ được chấp nhận luôn.
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isPrivate: false } });
    const pending = await tx.followRequest.findMany({ where: { targetId: userId } });
    for (const r of pending)
      await tx.follow.createMany({
        data: [{ followerId: r.requesterId, followeeId: userId }],
        skipDuplicates: true,
      });
    await tx.followRequest.deleteMany({ where: { targetId: userId } });
  });
  return { ok: true };
}

// Gửi / huỷ yêu cầu follow (bấm lần nữa là huỷ). toggleFollow gọi khi người được follow là tài khoản riêng tư.
export async function toggleFollowRequest(
  requesterId: string,
  targetId: string,
): Promise<{ requested: boolean }> {
  const removed = await db.followRequest.deleteMany({ where: { requesterId, targetId } });
  if (removed.count) return { requested: false };
  await db.followRequest.create({ data: { requesterId, targetId, createdAt: now() } }).catch((e) => {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
  });
  const me = await db.user.findUnique({ where: { id: requesterId }, select: { displayName: true } });
  await notifyEvent({
    userId: targetId,
    type: 'follow_request',
    key: 'notify.followRequest',
    vars: { name: me?.displayName ?? '9MUA' },
    url: '/tai-khoan/yeu-cau-follow',
  });
  return { requested: true };
}

export async function hasFollowRequest(requesterId: string | undefined, targetId: string): Promise<boolean> {
  if (!requesterId) return false;
  return Boolean(
    await db.followRequest.findUnique({ where: { requesterId_targetId: { requesterId, targetId } } }),
  );
}

export type FollowRequestView = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
};

export async function followRequests(userId: string): Promise<FollowRequestView[]> {
  return db.$queryRaw<FollowRequestView[]>`
    SELECT r."requesterId" AS "userId", u."displayName", u."avatarUrl", r."createdAt"
    FROM "FollowRequest" r JOIN "User" u ON u.id = r."requesterId"
    WHERE r."targetId" = ${userId} AND u."lockedAt" IS NULL
    ORDER BY r."createdAt" DESC LIMIT 200`;
}

// Chấp nhận → thành follow thật; từ chối → xoá yêu cầu (không báo người gửi).
export async function respondFollowRequest(
  ownerId: string,
  requesterId: string,
  accept: boolean,
): Promise<boolean> {
  const done = await db.$transaction(async (tx) => {
    const r = await tx.followRequest.deleteMany({ where: { requesterId, targetId: ownerId } });
    if (!r.count) return false;
    if (accept)
      await tx.follow.createMany({
        data: [{ followerId: requesterId, followeeId: ownerId }],
        skipDuplicates: true,
      });
    return true;
  });
  if (done && accept) {
    const me = await db.user.findUnique({ where: { id: ownerId }, select: { displayName: true } });
    await notifyEvent({
      userId: requesterId,
      type: 'follow',
      key: 'notify.followAccepted',
      vars: { name: me?.displayName ?? '9MUA' },
      url: `/creator/${ownerId}`,
    });
  }
  return done;
}

// Người xem có được xem nội dung trang cá nhân không (tài khoản riêng tư: chỉ người đang follow và chính mình).
export async function canSeeProfileContent(
  profileId: string,
  viewerId: string | undefined,
): Promise<boolean> {
  if (viewerId === profileId) return true;
  const u = await db.user.findUnique({ where: { id: profileId }, select: { isPrivate: true } });
  if (!u?.isPrivate) return true;
  if (!viewerId) return false;
  return Boolean(await db.follow.findFirst({ where: { followerId: viewerId, followeeId: profileId } }));
}
