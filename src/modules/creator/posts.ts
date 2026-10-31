import { randomBytes } from 'node:crypto';
import { isPrivateAccount } from '@/lib/private-accounts';
import { Prisma } from '@prisma/client';
import { blockedEitherIds, isBlockedEither, notBlockedWith } from '@/lib/blocks';
import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processImage } from '@/lib/media/process-image';
import { notifyKey } from '@/lib/notifications';
import { notifyEvent } from '@/lib/notify-events';
import { getProductForCheckout, kiotBasics, productPath } from '@/modules/kiot';
import { kiotOrigin } from '@/lib/urls';
import { hasCurrentCommitment } from '@/modules/identity';
import { extractHashtags } from './hashtags';
import { scheduleOk } from './posting';
import { isVisibility, type Visibility } from './visibility';
import type { Viewer } from './feed';

// Bài đăng ảnh + chữ (SPEC-creator.md V5.10, công tắc posts): chữ ≤ 2.000 ký tự (không link), 0–10 ảnh, bài chỉ chữ
// ≤ 300 ký tự chọn được 1 trong 6 nền màu; ≤ 3 sản phẩm; quyền riêng tư, nháp, hẹn giờ như video; 20 bài mỗi ngày.
export const MAX_POST_TEXT = 2000;
export const MAX_BG_TEXT = 300;
export const MAX_POST_IMAGES = 10;
export const MAX_POST_PRODUCTS = 3;
export const POSTS_PER_DAY = 20;
export const MAX_POST_COMMENT = 300;
export const POST_BG_COLORS = ['#ff6b00', '#e11d48', '#7c3aed', '#0ea5e9', '#16a34a', '#111111'] as const;
const UPLOAD_KEEP_MS = 24 * 3_600_000;

export type PostImageView = { url: string; thumbUrl: string; width: number; height: number };
export type PostView = {
  id: string;
  text: string;
  bgColor: string | null;
  images: PostImageView[];
  hashtags: string[];
  author: { id: string; displayName: string; avatarUrl: string | null };
  likes: number;
  liked: boolean;
  reaction: string | null; // cảm xúc của người xem (SPEC-social.md V5.8)
  saved: boolean;
  comments: number;
  allowComments: boolean;
  products: { id: string; name: string; price: number; thumbUrl: string | null; url: string }[];
  visibility: Visibility;
  status: string;
  edited: boolean;
  mine: boolean;
  createdAt: string;
};

export type PostInput = {
  text: string;
  imageIds: string[]; // PostUpload của chính người đăng, theo thứ tự hiện
  bgColor?: string | null;
  productIds?: string[];
  visibility?: string;
  allowComments?: boolean;
  soundId?: string | null;
  draft?: boolean;
  publishAt?: Date | null;
};

export type PostError =
  | 'COMMITMENT_REQUIRED'
  | 'EMPTY'
  | 'TOO_LONG'
  | 'HAS_LINK'
  | 'TOO_MANY_IMAGES'
  | 'IMAGE_INVALID'
  | 'BG_INVALID'
  | 'PRODUCT_INVALID'
  | 'SCHEDULE_INVALID'
  | 'DAILY_LIMIT'
  | 'NOT_FOUND';

// Ảnh của bài: xử lý như ảnh sản phẩm (xoay theo EXIF, WebP 1200px + 400px, bỏ metadata), ≤ 10MB.
export async function savePostImage(
  userId: string,
  data: Buffer,
): Promise<{ ok: true; id: string; thumbUrl: string } | { ok: false; error: string }> {
  if (data.length > 10 * 1024 * 1024) return { ok: false, error: 'TOO_LARGE' };
  const p = await processImage(data);
  if (!p.ok) return p;
  const key = `posts/${userId.slice(-6)}-${randomBytes(8).toString('hex')}`;
  const store = imageStore();
  const url = await store.save(`${key}.webp`, p.main);
  const thumbUrl = await store.save(`${key}-t.webp`, p.thumb);
  const row = await db.postUpload.create({
    data: { ownerId: userId, url, thumbUrl, width: p.width, height: p.height, createdAt: now() },
  });
  return { ok: true, id: row.id, thumbUrl };
}

const cleanText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

async function checkContent(
  userId: string,
  input: Pick<PostInput, 'text' | 'imageIds' | 'bgColor' | 'productIds'>,
  keepImages: { url: string }[] = [],
): Promise<
  | {
      ok: true;
      text: string;
      bgColor: string | null;
      uploads: { id: string; url: string; thumbUrl: string; width: number; height: number }[];
      productIds: string[];
    }
  | { ok: false; error: PostError }
> {
  const text = cleanText(input.text ?? '');
  if (text.length > MAX_POST_TEXT) return { ok: false, error: 'TOO_LONG' };
  if (hasLink(text)) return { ok: false, error: 'HAS_LINK' };
  const ids = [...new Set(input.imageIds ?? [])];
  if (ids.length > MAX_POST_IMAGES) return { ok: false, error: 'TOO_MANY_IMAGES' };
  const uploads = ids.length
    ? await db.postUpload.findMany({ where: { id: { in: ids }, ownerId: userId } })
    : [];
  if (uploads.length !== ids.length) return { ok: false, error: 'IMAGE_INVALID' };
  const ordered = ids.map((id) => uploads.find((u) => u.id === id)!);
  if (!text && ordered.length === 0 && keepImages.length === 0) return { ok: false, error: 'EMPTY' };
  let bgColor: string | null = null;
  if (input.bgColor) {
    if (
      !POST_BG_COLORS.includes(input.bgColor as (typeof POST_BG_COLORS)[number]) ||
      ordered.length ||
      !text ||
      text.length > MAX_BG_TEXT
    )
      return { ok: false, error: 'BG_INVALID' };
    bgColor = input.bgColor;
  }
  const productIds = [...new Set((input.productIds ?? []).filter(Boolean))];
  if (productIds.length > MAX_POST_PRODUCTS) return { ok: false, error: 'PRODUCT_INVALID' };
  for (const id of productIds)
    if (!(await getProductForCheckout(id))?.available) return { ok: false, error: 'PRODUCT_INVALID' };
  return { ok: true, text, bgColor, uploads: ordered, productIds };
}

export async function createPost(
  userId: string,
  input: PostInput,
): Promise<{ ok: true; postId: string } | { ok: false; error: PostError }> {
  if (!(await hasCurrentCommitment(userId))) return { ok: false, error: 'COMMITMENT_REQUIRED' };
  const c = await checkContent(userId, input);
  if (!c.ok) return c;
  const draft = input.draft === true;
  const publishAt = !draft && input.publishAt ? input.publishAt : null;
  if (publishAt && !scheduleOk(publishAt)) return { ok: false, error: 'SCHEDULE_INVALID' };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`post:${userId}`}))`;
    if (
      (await tx.post.count({ where: { authorId: userId, createdAt: { gte: startOfVnDay() } } })) >=
      POSTS_PER_DAY
    )
      return { ok: false as const, error: 'DAILY_LIMIT' as const };
    const t = now();
    const post = await tx.post.create({
      data: {
        authorId: userId,
        text: c.text,
        bgColor: c.bgColor,
        hashtags: extractHashtags(c.text),
        visibility: isVisibility(input.visibility) ? input.visibility : 'public',
        allowComments: input.allowComments !== false,
        soundId: input.soundId ?? null,
        status: draft ? 'draft' : publishAt ? 'scheduled' : 'ready',
        publishAt,
        createdAt: t,
        updatedAt: t,
        images: {
          create: c.uploads.map((u, position) => ({
            position,
            url: u.url,
            thumbUrl: u.thumbUrl,
            width: u.width,
            height: u.height,
          })),
        },
        products: { create: c.productIds.map((productId, position) => ({ productId, position })) },
      },
    });
    if (c.uploads.length)
      await tx.postUpload.deleteMany({ where: { id: { in: c.uploads.map((u) => u.id) } } });
    return { ok: true as const, postId: post.id };
  });
}

// Sửa chữ, ảnh (giữ ảnh cũ theo thứ tự keep + thêm ảnh mới), sản phẩm sau khi đăng → "Đã chỉnh sửa".
export async function updatePost(
  userId: string,
  postId: string,
  patch: {
    text: string;
    keepImageUrls: string[];
    imageIds: string[];
    productIds: string[];
    bgColor?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: PostError }> {
  const post = await db.post.findFirst({
    where: { id: postId, authorId: userId, status: { notIn: ['deleted', 'removed'] } },
    include: { images: { orderBy: { position: 'asc' } } },
  });
  if (!post) return { ok: false, error: 'NOT_FOUND' };
  const keep = patch.keepImageUrls
    .map((u) => post.images.find((i) => i.url === u))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));
  if (keep.length + patch.imageIds.length > MAX_POST_IMAGES) return { ok: false, error: 'TOO_MANY_IMAGES' };
  const c = await checkContent(userId, { ...patch, bgColor: keep.length ? null : patch.bgColor }, keep);
  if (!c.ok) return c;
  const dropped = post.images.filter((i) => !keep.includes(i));
  await db.$transaction(async (tx) => {
    await tx.postImage.deleteMany({ where: { postId } });
    await tx.postProduct.deleteMany({ where: { postId } });
    await tx.post.update({
      where: { id: postId },
      data: {
        text: c.text,
        bgColor: c.bgColor,
        hashtags: extractHashtags(c.text),
        editedAt: now(),
        updatedAt: now(),
        images: {
          create: [...keep, ...c.uploads].map((u, position) => ({
            position,
            url: u.url,
            thumbUrl: u.thumbUrl,
            width: u.width,
            height: u.height,
          })),
        },
        products: { create: c.productIds.map((productId, position) => ({ productId, position })) },
      },
    });
    if (c.uploads.length)
      await tx.postUpload.deleteMany({ where: { id: { in: c.uploads.map((u) => u.id) } } });
  });
  for (const i of dropped) {
    await imageStore()
      .remove(i.url)
      .catch(() => {});
    await imageStore()
      .remove(i.thumbUrl)
      .catch(() => {});
  }
  return { ok: true };
}

export async function deletePost(userId: string, postId: string): Promise<boolean> {
  const post = await db.post.findFirst({
    where: { id: postId, authorId: userId },
    include: { images: true },
  });
  if (!post || post.status === 'deleted') return false;
  await db.post.update({ where: { id: postId }, data: { status: 'deleted', updatedAt: now() } });
  for (const i of post.images) {
    await imageStore()
      .remove(i.url)
      .catch(() => {});
    await imageStore()
      .remove(i.thumbUrl)
      .catch(() => {});
  }
  await db.postImage.deleteMany({ where: { postId } });
  return true;
}

// Bài hẹn giờ tới giờ thì lên (worker mỗi phút + cron dự phòng).
export async function publishScheduledPosts(): Promise<number> {
  const r = await db.post.updateMany({
    where: { status: 'scheduled', publishAt: { lte: now() } },
    data: { status: 'ready', createdAt: now() },
  });
  return r.count;
}

// Ảnh tải lên mà không đăng bài trong 24 giờ: xoá.
export async function cleanupPostUploads(): Promise<number> {
  const old = await db.postUpload.findMany({
    where: { createdAt: { lt: new Date(now().getTime() - UPLOAD_KEEP_MS) } },
    take: 500,
  });
  for (const u of old) {
    await imageStore()
      .remove(u.url)
      .catch(() => {});
    await imageStore()
      .remove(u.thumbUrl)
      .catch(() => {});
  }
  if (old.length) await db.postUpload.deleteMany({ where: { id: { in: old.map((u) => u.id) } } });
  return old.length;
}

// Chỉ đọc bảng nhóm (social ghi). Quản trị nhóm thấy cả bài chờ duyệt; thành viên bị cấm / nhóm bị khoá không thấy.
async function groupPostVisible(postId: string, viewerId?: string | null): Promise<boolean> {
  const rows = await db.$queryRaw<{ ok: number }[]>`
    SELECT 1 AS ok FROM "CommunityPost" cp JOIN "CommunityGroup" g ON g.id = cp."groupId"
    LEFT JOIN "CommunityMember" m ON m."groupId" = g.id AND m."userId" = ${viewerId ?? ''}
    WHERE cp."postId" = ${postId} AND g.status = 'active' AND (
      (cp.status = 'published' AND (g.privacy = 'public' OR m.status = 'active'))
      OR (m.status = 'active' AND m.role IN ('owner', 'admin')))
    LIMIT 1`;
  return rows.length > 0;
}

// Quyền xem bài: như video (công khai / người follow / riêng tư), không chặn nhau, người đăng không bị khoá.
export async function canViewPost(postId: string, viewerId?: string | null): Promise<boolean> {
  const p = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true, status: true, visibility: true },
  });
  if (!p || p.status === 'deleted' || p.status === 'removed') return false;
  if (viewerId && viewerId === p.authorId) return true;
  if (p.status !== 'ready') return false;
  const author = await db.user.findUnique({
    where: { id: p.authorId },
    select: { lockedAt: true, isPrivate: true },
  });
  if (!author || author.lockedAt) return false;
  if (viewerId && (await isBlockedEither(viewerId, p.authorId))) return false;
  if (p.visibility === 'public' && !author.isPrivate) return true;
  // Bài trong nhóm (SPEC-social.md V5.10) là bài riêng tư: nhóm công khai ai cũng xem, nhóm riêng tư chỉ thành viên.
  if (p.visibility === 'private') return groupPostVisible(postId, viewerId);
  // Tài khoản riêng tư (SPEC-identity.md V5.2): bài public hiển thị như followers.
  if (p.visibility === 'private' || !viewerId) return false;
  return Boolean(await db.follow.findFirst({ where: { followerId: viewerId, followeeId: p.authorId } }));
}

async function productCards(ids: string[]) {
  const found = (await Promise.all(ids.map((id) => getProductForCheckout(id)))).filter(
    (p): p is NonNullable<typeof p> => Boolean(p?.available),
  );
  const kiots = await kiotBasics([...new Set(found.map((p) => p.kiotId))]);
  return new Map(
    found.flatMap((p) => {
      const k = kiots.find((x) => x.id === p.kiotId);
      return k
        ? [
            [
              p.id,
              {
                id: p.id,
                name: p.name,
                price: p.price,
                thumbUrl: p.imageUrl,
                url: `${kiotOrigin(k.slug)}${productPath(p)}`,
              },
            ] as const,
          ]
        : [];
    }),
  );
}

export async function hydratePosts(ids: string[], viewer: Viewer): Promise<PostView[]> {
  if (!ids.length) return [];
  const posts = await db.post.findMany({
    where: { id: { in: ids } },
    include: { images: { orderBy: { position: 'asc' } }, products: { orderBy: { position: 'asc' } } },
  });
  const [authors, liked, saved, counts, cards] = await Promise.all([
    db.user.findMany({
      where: { id: { in: [...new Set(posts.map((p) => p.authorId))] } },
      select: { id: true, displayName: true, avatarUrl: true },
    }),
    viewer.userId
      ? db.reaction.findMany({
          where: { userId: viewer.userId, postId: { in: ids } },
          select: { postId: true, reaction: true },
        })
      : [],
    viewer.userId
      ? db.savedPost.findMany({
          where: { userId: viewer.userId, postId: { in: ids } },
          select: { postId: true },
        })
      : [],
    db.postComment.groupBy({
      by: ['postId'],
      where: { postId: { in: ids }, hiddenAt: null },
      _count: { _all: true },
    }),
    productCards([...new Set(posts.flatMap((p) => p.products.map((x) => x.productId)))]),
  ]);
  const likedSet = new Set(liked.map((l) => l.postId));
  const savedSet = new Set(saved.map((s) => s.postId));
  return ids
    .map((id) => posts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      id: p.id,
      text: p.text,
      bgColor: p.bgColor,
      images: p.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl, width: i.width, height: i.height })),
      hashtags: p.hashtags,
      author: authors.find((a) => a.id === p.authorId) ?? {
        id: p.authorId,
        displayName: '9MUA',
        avatarUrl: null,
      },
      likes: p.likes,
      liked: likedSet.has(p.id),
      reaction: liked.find((l) => l.postId === p.id)?.reaction ?? null,
      saved: savedSet.has(p.id),
      comments: counts.find((c) => c.postId === p.id)?._count._all ?? 0,
      allowComments: p.allowComments,
      products: p.products
        .map((x) => cards.get(x.productId))
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
      visibility: isVisibility(p.visibility) ? p.visibility : 'public',
      status: p.status,
      edited: p.editedAt !== null,
      mine: viewer.userId === p.authorId,
      createdAt: p.createdAt.toISOString(),
    }));
}

const LISTED = (viewerId: string | undefined) => Prisma.sql`p.status = 'ready' AND u."lockedAt" IS NULL
  AND ${notBlockedWith(viewerId, Prisma.sql`p."authorId"`)}`;

// Bài công khai mới nhất cho feed trang chủ (chèn giữa các video). cursor = createdAt|id của bài cuối.
export async function postFeed(
  viewer: Viewer,
  cursor?: string | null,
  take = 4,
): Promise<{ items: PostView[]; nextCursor: string | null }> {
  const [at, id] = (cursor ?? '').split('|');
  const after = at && id ? Prisma.sql`AND (p."createdAt", p.id) < (${new Date(at)}, ${id})` : Prisma.empty;
  const rows = await db.$queryRaw<{ id: string; createdAt: Date }[]>`
    SELECT p.id, p."createdAt" FROM "Post" p JOIN "User" u ON u.id = p."authorId"
    WHERE ${LISTED(viewer.userId)} AND p.visibility = 'public' AND NOT u."isPrivate" ${after}
    ORDER BY p."createdAt" DESC, p.id DESC LIMIT ${take + 1}`;
  const page = rows.slice(0, take);
  const last = page.at(-1);
  return {
    items: await hydratePosts(
      page.map((r) => r.id),
      viewer,
    ),
    nextCursor: rows.length > take && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
}

// Tab "Bài viết" trên trang cá nhân: theo quyền xem của người đang xem (mình thấy cả bài riêng tư, nháp, hẹn giờ).
export async function postsByAuthor(authorId: string, viewer: Viewer, take = 60): Promise<PostView[]> {
  const mine = viewer.userId === authorId;
  const follows =
    !mine && viewer.userId
      ? Boolean(await db.follow.findFirst({ where: { followerId: viewer.userId, followeeId: authorId } }))
      : false;
  if (!mine && viewer.userId && (await isBlockedEither(viewer.userId, authorId))) return [];
  const rows = await db.post.findMany({
    where: {
      authorId,
      status: mine ? { notIn: ['deleted', 'removed'] } : 'ready',
      ...(mine
        ? {}
        : {
            visibility: {
              in: follows ? ['public', 'followers'] : (await isPrivateAccount(authorId)) ? [] : ['public'],
            },
          }),
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true },
  });
  return hydratePosts(
    rows.map((r) => r.id),
    viewer,
  );
}

export async function hashtagPosts(tag: string, viewer: Viewer, take = 30): Promise<PostView[]> {
  if (!tag) return [];
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "Post" p JOIN "User" u ON u.id = p."authorId"
    WHERE ${LISTED(viewer.userId)} AND p.visibility = 'public' AND NOT u."isPrivate" AND ${tag} = ANY(p.hashtags)
    ORDER BY p."createdAt" DESC LIMIT ${take}`;
  return hydratePosts(
    rows.map((r) => r.id),
    viewer,
  );
}

export async function getPost(postId: string, viewer: Viewer): Promise<PostView | null> {
  if (!(await canViewPost(postId, viewer.userId))) return null;
  return (await hydratePosts([postId], viewer))[0] ?? null;
}

// Thích bài (cảm xúc "like"; đủ 6 cảm xúc ở T102). Số trên nút là tổng cảm xúc.
export async function togglePostLike(
  userId: string,
  postId: string,
): Promise<{ ok: boolean; liked: boolean; likes: number }> {
  if (!(await canViewPost(postId, userId))) return { ok: false, liked: false, likes: 0 };
  const key = { userId_postId: { userId, postId } };
  const had = await db.reaction.findUnique({ where: key });
  const post = await db.$transaction(async (tx) => {
    if (had) await tx.reaction.delete({ where: key });
    else await tx.reaction.create({ data: { userId, postId, createdAt: now() } });
    return tx.post.update({
      where: { id: postId },
      data: { likes: { increment: had ? -1 : 1 } },
      select: { likes: true, authorId: true },
    });
  });
  if (!had && post.authorId !== userId) {
    const me = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    await notifyEvent({
      userId: post.authorId,
      type: 'like',
      key: 'notify.postLiked',
      groupedKey: 'notify.postLikedMany',
      vars: { name: me?.displayName ?? '9MUA' },
      url: `/p/${postId}`,
      groupKey: `like:post:${postId}`,
    });
  }
  return { ok: true, liked: !had, likes: post.likes };
}

export async function toggleSavePost(
  userId: string,
  postId: string,
): Promise<{ ok: boolean; saved: boolean }> {
  if (!(await canViewPost(postId, userId))) return { ok: false, saved: false };
  const key = { userId_postId: { userId, postId } };
  if (await db.savedPost.findUnique({ where: key })) {
    await db.savedPost.delete({ where: key });
    return { ok: true, saved: false };
  }
  await db.savedPost.create({ data: { userId, postId, createdAt: now() } });
  return { ok: true, saved: true };
}

export const POST_REPORT_REASONS = ['noi_dung_xau', 'lua_dao', 'ban_quyen', 'khac'] as const;

export const POST_AUTO_HIDE_REPORTERS = 5;

// Báo cáo như video: 5 người báo cáo thì bài tự ẩn chờ CEO xem.
export async function reportPost(userId: string, postId: string, reason: string): Promise<boolean> {
  if (!POST_REPORT_REASONS.includes(reason as (typeof POST_REPORT_REASONS)[number])) return false;
  if (!(await canViewPost(postId, userId))) return false;
  await db.postReport.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId, reason, createdAt: now() },
    update: {},
  });
  if ((await db.postReport.count({ where: { postId, status: 'open' } })) >= POST_AUTO_HIDE_REPORTERS)
    await db.post.updateMany({
      where: { id: postId, status: 'ready' },
      data: { status: 'removed', moderationNote: 'Tự ẩn: 5 người báo cáo' },
    });
  return true;
}

// Hàng chờ CEO ở /admin/bao-cao: bài đang có báo cáo mở.
export async function listPostReports() {
  const reports = await db.postReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const ids = [...new Set(reports.map((r) => r.postId))];
  const posts = await db.post.findMany({
    where: { id: { in: ids } },
    select: { id: true, text: true, status: true, authorId: true },
  });
  return ids.map((id) => ({
    post: posts.find((p) => p.id === id) ?? null,
    reports: reports
      .filter((r) => r.postId === id)
      .map((r) => ({ reason: r.reason, createdAt: r.createdAt })),
  }));
}

// CEO gỡ bài (removed) hoặc bỏ qua báo cáo (mở lại bài đã tự ẩn).
export async function resolvePostReports(
  postId: string,
  action: 'remove' | 'dismiss',
  note: string | null,
): Promise<boolean> {
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post) return false;
  await db.$transaction([
    db.postReport.updateMany({
      where: { postId, status: 'open' },
      data: { status: action === 'remove' ? 'actioned' : 'dismissed' },
    }),
    db.post.update({
      where: { id: postId },
      data:
        action === 'remove'
          ? { status: 'removed', moderationNote: note || 'CEO gỡ' }
          : post.status === 'removed'
            ? { status: 'ready', moderationNote: null }
            : {},
    }),
  ]);
  return true;
}

// Trang sửa bài: chỉ chủ bài, bài chưa xoá / chưa bị gỡ.
export async function postForEdit(userId: string, postId: string) {
  return db.post.findFirst({
    where: { id: postId, authorId: userId, status: { notIn: ['deleted', 'removed'] } },
    include: { images: { orderBy: { position: 'asc' } }, products: { orderBy: { position: 'asc' } } },
  });
}

export type PostCommentView = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  byAuthor: boolean;
};

export async function addPostComment(
  userId: string,
  postId: string,
  raw: string,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: 'EMPTY' | 'TOO_LONG' | 'HAS_LINK' | 'NOT_FOUND' | 'COMMENTS_OFF' | 'RATE_LIMIT' }
> {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  if (text.length > MAX_POST_COMMENT) return { ok: false, error: 'TOO_LONG' };
  if (hasLink(text)) return { ok: false, error: 'HAS_LINK' };
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true, allowComments: true },
  });
  if (!post || !(await canViewPost(postId, userId))) return { ok: false, error: 'NOT_FOUND' };
  if (!post.allowComments) return { ok: false, error: 'COMMENTS_OFF' };
  const t = now();
  const last = await db.postComment.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last && t.getTime() - last.createdAt.getTime() < 10_000) return { ok: false, error: 'RATE_LIMIT' };
  const c = await db.postComment.create({ data: { postId, userId, text, createdAt: t } });
  if (post.authorId !== userId) {
    const me = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    await notifyKey(
      post.authorId,
      'notify.newComment',
      { name: me?.displayName ?? '9MUA', text: text.slice(0, 60) },
      `/p/${postId}`,
    );
  }
  return { ok: true, id: c.id };
}

export async function listPostComments(postId: string, viewerId?: string | null): Promise<PostCommentView[]> {
  const post = await db.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post || !(await canViewPost(postId, viewerId))) return [];
  const blocked = await blockedEitherIds(viewerId ?? undefined);
  const rows = (
    await db.postComment.findMany({
      where: { postId, hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
  ).filter((r) => !blocked.has(r.userId));
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    author: users.find((u) => u.id === r.userId) ?? { id: r.userId, displayName: '9MUA', avatarUrl: null },
    byAuthor: r.userId === post.authorId,
  }));
}
