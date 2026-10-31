import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processCroppedImage } from '@/lib/media/process-image';
import { createPost, hydratePosts, hydrateVideos, type FeedVideo, type PostView } from '@/modules/creator';

// Nhóm cộng đồng (SPEC-social.md V5.10, công tắc groups). Nhóm Công khai: ai cũng xem và vào thẳng; Riêng tư: phải được
// duyệt, bài chỉ thành viên thấy. Bài viết trong nhóm là Post riêng tư của người đăng + dòng CommunityPost (creator cho
// thành viên xem qua canViewPost); video là video sẵn có của người đăng.
export const MAX_GROUP_NAME = 60;
export const MAX_GROUP_DESCRIPTION = 500;
export const MAX_GROUPS_OWNED = 5;
export const MAX_GROUP_ADMINS = 3; // ngoài người tạo
export const MAX_GROUP_MEMBERS = 10_000;
const MIN_ACCOUNT_DAYS = 7;
const DAY = 86_400_000;

export type GroupPrivacy = 'public' | 'private';
export type GroupRole = 'owner' | 'admin' | 'member';
export type GroupError =
  | 'INVALID'
  | 'HAS_LINK'
  | 'TOO_NEW'
  | 'LIMIT'
  | 'NOT_FOUND'
  | 'FULL'
  | 'BANNED'
  | 'FORBIDDEN'
  | 'ADMIN_LIMIT'
  | 'POST_FAILED';

export type GroupView = {
  id: string;
  name: string;
  description: string;
  avatarPath: string | null;
  privacy: GroupPrivacy;
  approvePosts: boolean;
  status: string;
  lockReason: string | null;
  memberCount: number;
  ownerId: string;
  myRole: GroupRole | null;
  myStatus: 'active' | 'pending' | 'banned' | null;
};

const isAdminRole = (r: string | null | undefined) => r === 'owner' || r === 'admin';

async function membership(groupId: string, userId: string | undefined) {
  if (!userId) return null;
  return db.communityMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
}

// Quản trị (người tạo hoặc quản trị viên) đang hoạt động của một nhóm chưa bị khoá.
async function requireGroupAdmin(groupId: string, userId: string) {
  const g = await db.communityGroup.findUnique({ where: { id: groupId } });
  const m = await membership(groupId, userId);
  if (!g || g.status !== 'active' || !m || m.status !== 'active' || !isAdminRole(m.role)) return null;
  return { group: g, member: m };
}

export async function createGroup(
  userId: string,
  input: { name: string; description?: string; privacy: string },
): Promise<{ ok: true; groupId: string } | { ok: false; error: GroupError }> {
  const name = input.name.replace(/\s+/g, ' ').trim();
  const description = (input.description ?? '').trim();
  if (!name || name.length > MAX_GROUP_NAME || description.length > MAX_GROUP_DESCRIPTION)
    return { ok: false, error: 'INVALID' };
  if (input.privacy !== 'public' && input.privacy !== 'private') return { ok: false, error: 'INVALID' };
  if (hasLink(name) || hasLink(description)) return { ok: false, error: 'HAS_LINK' };
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true, lockedAt: true } });
  if (!u || u.lockedAt || u.createdAt.getTime() > now().getTime() - MIN_ACCOUNT_DAYS * DAY)
    return { ok: false, error: 'TOO_NEW' };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group:${userId}`}))`;
    if ((await tx.communityGroup.count({ where: { ownerId: userId } })) >= MAX_GROUPS_OWNED)
      return { ok: false as const, error: 'LIMIT' as const };
    const t = now();
    const g = await tx.communityGroup.create({
      data: {
        ownerId: userId,
        name,
        description,
        privacy: input.privacy,
        memberCount: 1,
        createdAt: t,
        updatedAt: t,
      },
    });
    await tx.communityMember.create({
      data: { groupId: g.id, userId, role: 'owner', status: 'active', createdAt: t },
    });
    return { ok: true as const, groupId: g.id };
  });
}

// Ảnh nhóm vuông 400×400 WebP.
export async function setGroupAvatar(
  userId: string,
  groupId: string,
  image: Buffer,
): Promise<{ ok: boolean }> {
  const a = await requireGroupAdmin(groupId, userId);
  if (!a) return { ok: false };
  const p = await processCroppedImage(image, { width: 400, height: 400 });
  if (!p.ok) return { ok: false };
  const path = await imageStore().save(`groups/${groupId}-${randomBytes(6).toString('hex')}.webp`, p.data);
  await db.communityGroup.update({ where: { id: groupId }, data: { avatarPath: path, updatedAt: now() } });
  if (a.group.avatarPath)
    await imageStore()
      .remove(a.group.avatarPath)
      .catch(() => {});
  return { ok: true };
}

export async function groupPage(groupId: string, viewerId: string | undefined): Promise<GroupView | null> {
  const g = await db.communityGroup.findUnique({ where: { id: groupId } });
  if (!g) return null;
  const m = await membership(groupId, viewerId);
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    avatarPath: g.avatarPath,
    privacy: g.privacy === 'private' ? 'private' : 'public',
    approvePosts: g.approvePosts,
    status: g.status,
    lockReason: g.lockReason,
    memberCount: g.memberCount,
    ownerId: g.ownerId,
    myRole: m ? (m.role as GroupRole) : null,
    myStatus: m ? (m.status as GroupView['myStatus']) : null,
  };
}

// Công khai: vào thẳng; Riêng tư: chờ quản trị duyệt. Bị cấm thì không vào lại được.
export async function joinGroup(
  userId: string,
  groupId: string,
): Promise<{ ok: true; status: 'active' | 'pending' } | { ok: false; error: GroupError }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group-members:${groupId}`}))`;
    const g = await tx.communityGroup.findUnique({ where: { id: groupId } });
    if (!g || g.status !== 'active') return { ok: false as const, error: 'NOT_FOUND' as const };
    const m = await tx.communityMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (m?.status === 'banned') return { ok: false as const, error: 'BANNED' as const };
    if (m) return { ok: true as const, status: m.status as 'active' | 'pending' };
    if (g.memberCount >= MAX_GROUP_MEMBERS) return { ok: false as const, error: 'FULL' as const };
    const status = g.privacy === 'private' ? 'pending' : 'active';
    await tx.communityMember.create({ data: { groupId, userId, role: 'member', status, createdAt: now() } });
    if (status === 'active')
      await tx.communityGroup.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } });
    return { ok: true as const, status };
  });
}

// Rời nhóm / huỷ yêu cầu vào. Người tạo không rời được.
export async function leaveGroup(userId: string, groupId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group-members:${groupId}`}))`;
    const m = await tx.communityMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!m || m.role === 'owner' || m.status === 'banned') return false;
    await tx.communityMember.delete({ where: { groupId_userId: { groupId, userId } } });
    if (m.status === 'active')
      await tx.communityGroup.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } });
    return true;
  });
}

export async function approveMember(
  adminId: string,
  groupId: string,
  userId: string,
  approve: boolean,
): Promise<boolean> {
  if (!(await requireGroupAdmin(groupId, adminId))) return false;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group-members:${groupId}`}))`;
    const g = await tx.communityGroup.findUniqueOrThrow({ where: { id: groupId } });
    const m = await tx.communityMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!m || m.status !== 'pending') return false;
    if (!approve) {
      await tx.communityMember.delete({ where: { groupId_userId: { groupId, userId } } });
      return true;
    }
    if (g.memberCount >= MAX_GROUP_MEMBERS) return false;
    await tx.communityMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { status: 'active' },
    });
    await tx.communityGroup.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } });
    return true;
  });
}

// Chỉ người tạo đặt / bỏ quản trị viên; tối đa 3 quản trị viên.
export async function setGroupAdmin(
  ownerId: string,
  groupId: string,
  userId: string,
  admin: boolean,
): Promise<{ ok: true } | { ok: false; error: GroupError }> {
  const a = await requireGroupAdmin(groupId, ownerId);
  if (!a || a.member.role !== 'owner' || userId === ownerId) return { ok: false, error: 'FORBIDDEN' };
  const m = await membership(groupId, userId);
  if (!m || m.status !== 'active') return { ok: false, error: 'NOT_FOUND' };
  if (admin && (await db.communityMember.count({ where: { groupId, role: 'admin' } })) >= MAX_GROUP_ADMINS)
    return { ok: false, error: 'ADMIN_LIMIT' };
  await db.communityMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { role: admin ? 'admin' : 'member' },
  });
  return { ok: true };
}

// Cấm thành viên: không đăng, không vào lại. Quản trị viên chỉ cấm được thành viên thường.
export async function banMember(adminId: string, groupId: string, userId: string): Promise<boolean> {
  const a = await requireGroupAdmin(groupId, adminId);
  if (!a || userId === adminId) return false;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group-members:${groupId}`}))`;
    const m = await tx.communityMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (m?.role === 'owner' || (m?.role === 'admin' && a.member.role !== 'owner') || m?.status === 'banned')
      return false;
    await tx.communityMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, role: 'member', status: 'banned', createdAt: now() },
      update: { role: 'member', status: 'banned' },
    });
    if (m?.status === 'active')
      await tx.communityGroup.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } });
    return true;
  });
}

export async function setApprovePosts(adminId: string, groupId: string, on: boolean): Promise<boolean> {
  if (!(await requireGroupAdmin(groupId, adminId))) return false;
  await db.communityGroup.update({ where: { id: groupId }, data: { approvePosts: on, updatedAt: now() } });
  return true;
}

// Đăng vào nhóm: bài viết chữ (tạo Post riêng tư) hoặc video sẵn có của mình. Nhóm bật duyệt bài thì bài của thành viên
// thường chờ quản trị duyệt.
export async function postToGroup(
  userId: string,
  groupId: string,
  input: { text: string } | { videoId: string },
): Promise<{ ok: true; id: string; status: 'pending' | 'published' } | { ok: false; error: GroupError }> {
  const g = await db.communityGroup.findUnique({ where: { id: groupId } });
  const m = await membership(groupId, userId);
  if (!g || g.status !== 'active') return { ok: false, error: 'NOT_FOUND' };
  if (!m || m.status !== 'active')
    return { ok: false, error: m?.status === 'banned' ? 'BANNED' : 'FORBIDDEN' };
  const status = g.approvePosts && !isAdminRole(m.role) ? 'pending' : 'published';
  let ref: { postId: string } | { videoId: string };
  if ('videoId' in input) {
    const v = await db.video.findFirst({ where: { id: input.videoId, authorId: userId, status: 'ready' } });
    if (!v) return { ok: false, error: 'NOT_FOUND' };
    ref = { videoId: v.id };
  } else {
    const r = await createPost(userId, { text: input.text, imageIds: [], visibility: 'private' });
    if (!r.ok) return { ok: false, error: 'POST_FAILED' };
    ref = { postId: r.postId };
  }
  const cp = await db.communityPost.create({
    data: { groupId, authorId: userId, ...ref, status, createdAt: now() },
  });
  return { ok: true, id: cp.id, status };
}

export async function moderateGroupPost(
  adminId: string,
  communityPostId: string,
  action: 'approve' | 'remove',
): Promise<boolean> {
  const cp = await db.communityPost.findUnique({ where: { id: communityPostId } });
  if (!cp || !(await requireGroupAdmin(cp.groupId, adminId))) return false;
  await db.communityPost.update({
    where: { id: cp.id },
    data: { status: action === 'approve' ? 'published' : 'removed' },
  });
  return true;
}

export type GroupItem = { id: string; status: string; post: PostView | null; video: FeedVideo | null };

async function hydrateItems(
  rows: { id: string; status: string; postId: string | null; videoId: string | null }[],
  viewerId?: string,
) {
  const viewer = { userId: viewerId };
  const posts = await hydratePosts(
    rows.flatMap((r) => (r.postId ? [r.postId] : [])),
    viewer,
  );
  const videos = await hydrateVideos(
    rows.flatMap((r) => (r.videoId ? [r.videoId] : [])),
    viewer,
  );
  return rows
    .map((r) => ({
      id: r.id,
      status: r.status,
      post: posts.find((p) => p.id === r.postId) ?? null,
      video: videos.find((v) => v.id === r.videoId) ?? null,
    }))
    .filter((i) => i.post || i.video);
}

// Bài đã đăng trong nhóm, mới nhất trước. Nhóm riêng tư: chỉ thành viên thấy. Nhóm bị khoá: không ai thấy.
export async function groupFeed(
  groupId: string,
  viewerId: string | undefined,
  take = 30,
): Promise<GroupItem[] | null> {
  const g = await db.communityGroup.findUnique({ where: { id: groupId } });
  if (!g || g.status !== 'active') return null;
  const m = await membership(groupId, viewerId);
  if (g.privacy === 'private' && m?.status !== 'active') return null;
  const rows = await db.communityPost.findMany({
    where: { groupId, status: 'published' },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return hydrateItems(rows, viewerId);
}

// Trang quản trị nhóm: người chờ duyệt, bài chờ duyệt, danh sách thành viên.
export async function groupAdminData(adminId: string, groupId: string) {
  const a = await requireGroupAdmin(groupId, adminId);
  if (!a) return null;
  const [members, pendingRows] = await Promise.all([
    db.$queryRaw<{ userId: string; displayName: string; role: string; status: string }[]>`
      SELECT m."userId", u."displayName", m.role, m.status FROM "CommunityMember" m JOIN "User" u ON u.id = m."userId"
      WHERE m."groupId" = ${groupId}
      ORDER BY CASE m.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, m."createdAt" DESC LIMIT 300`,
    db.communityPost.findMany({
      where: { groupId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
  ]);
  return {
    group: a.group,
    myRole: a.member.role as GroupRole,
    members,
    pendingPosts: await hydrateItems(pendingRows, adminId),
  };
}

export type GroupCard = {
  id: string;
  name: string;
  avatarPath: string | null;
  privacy: string;
  memberCount: number;
};

export async function myGroups(userId: string): Promise<GroupCard[]> {
  return db.$queryRaw<GroupCard[]>`
    SELECT g.id, g.name, g."avatarPath", g.privacy, g."memberCount" FROM "CommunityGroup" g
    JOIN "CommunityMember" m ON m."groupId" = g.id AND m."userId" = ${userId} AND m.status = 'active'
    WHERE g.status = 'active' ORDER BY m."createdAt" DESC LIMIT 100`;
}

// Gợi ý: nhóm công khai đông thành viên mà mình chưa vào.
export async function suggestedGroups(userId: string | undefined, take = 20): Promise<GroupCard[]> {
  return db.$queryRaw<GroupCard[]>`
    SELECT g.id, g.name, g."avatarPath", g.privacy, g."memberCount" FROM "CommunityGroup" g
    WHERE g.status = 'active' AND g.privacy = 'public'
      AND NOT EXISTS (SELECT 1 FROM "CommunityMember" m WHERE m."groupId" = g.id AND m."userId" = ${userId ?? ''})
    ORDER BY g."memberCount" DESC, g."createdAt" DESC LIMIT ${take}`;
}

// Báo cáo nhóm hoặc một bài trong nhóm → hàng chờ CEO (/admin/bao-cao).
export async function reportGroup(
  userId: string,
  groupId: string,
  reason: string,
  communityPostId?: string,
): Promise<boolean> {
  const g = await db.communityGroup.findUnique({ where: { id: groupId } });
  if (!g || g.ownerId === userId) return false;
  const target = communityPostId ?? groupId;
  await db.groupReport.upsert({
    where: { userId_target: { userId, target } },
    create: {
      groupId,
      communityPostId: communityPostId ?? null,
      target,
      userId,
      reason: reason.slice(0, 50),
      createdAt: now(),
    },
    update: {},
  });
  return true;
}

export async function listGroupReports() {
  const reports = await db.groupReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const ids = [...new Set(reports.map((r) => r.groupId))];
  const groups = await db.communityGroup.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, status: true },
  });
  return ids.map((id) => ({
    group: groups.find((g) => g.id === id) ?? null,
    count: reports.filter((r) => r.groupId === id).length,
    reasons: [...new Set(reports.filter((r) => r.groupId === id).map((r) => r.reason))].slice(0, 5),
  }));
}

// CEO khoá nhóm kèm lý do, hoặc bỏ qua báo cáo.
export async function resolveGroupReports(
  groupId: string,
  action: 'lock' | 'dismiss',
  reason = '',
): Promise<boolean> {
  const g = await db.communityGroup.findUnique({ where: { id: groupId } });
  if (!g) return false;
  await db.$transaction([
    db.groupReport.updateMany({
      where: { groupId, status: 'open' },
      data: { status: action === 'lock' ? 'actioned' : 'dismissed' },
    }),
    ...(action === 'lock'
      ? [
          db.communityGroup.update({
            where: { id: groupId },
            data: { status: 'locked', lockReason: reason.slice(0, 200) || null, updatedAt: now() },
          }),
        ]
      : []),
  ]);
  return true;
}

// Video sẵn có của mình để đăng vào nhóm.
export async function myShareableVideos(userId: string): Promise<{ id: string; caption: string }[]> {
  return db.video.findMany({
    where: { authorId: userId, status: 'ready', kind: 'video' },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, caption: true },
  });
}
