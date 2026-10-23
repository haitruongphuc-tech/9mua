import { db } from '@/lib/db';
import { normalizeIdentifier } from '@/modules/identity';
import { getBalance } from '@/modules/payouts';

// Tra cứu cho CEO (SPEC-admin.md mục 4). Chỉ đọc; mọi kết quả có giới hạn số dòng.
export async function searchUsers(q: string) {
  const query = q.trim();
  if (!query) return [];
  const id = normalizeIdentifier(query);
  const users = await db.user.findMany({
    where: id ? id.where : { displayName: { contains: query, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      displayName: true,
      phone: true,
      email: true,
      role: true,
      lockedAt: true,
      createdAt: true,
    },
  });
  return Promise.all(
    users.map(async (u) => ({
      ...u,
      kiot: await db.kiot.findUnique({
        where: { ownerId: u.id },
        select: { id: true, name: true, slug: true },
      }),
      orders: await db.order.count({ where: { buyerId: u.id, paidAt: { not: null } } }),
      videos: await db.video.count({ where: { authorId: u.id, status: { not: 'deleted' } } }),
    })),
  );
}

export async function searchKiots(q: string) {
  const query = q.trim();
  if (!query) return [];
  const kiots = await db.kiot.findMany({
    where: {
      OR: [{ slug: { contains: query.toLowerCase() } }, { name: { contains: query, mode: 'insensitive' } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      owner: { select: { displayName: true, phone: true } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });
  return Promise.all(kiots.map(async (k) => ({ ...k, balance: await getBalance(k.id) })));
}

export async function searchOrders(q: string) {
  const query = q.trim();
  if (!query) return [];
  const id = normalizeIdentifier(query);
  const buyer =
    id?.kind === 'phone' ? await db.user.findUnique({ where: id.where, select: { id: true } }) : null;
  const kiot = !buyer
    ? await db.kiot.findUnique({ where: { slug: query.toLowerCase() }, select: { id: true } })
    : null;
  const where = buyer ? { buyerId: buyer.id } : kiot ? { kiotId: kiot.id } : { code: query.toUpperCase() };
  return db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      items: true,
      events: { orderBy: { createdAt: 'asc' } },
      kiot: { select: { name: true, slug: true } },
    },
  });
}
