import { createHash } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';

// Nhập Page từ mạng xã hội (SPEC-kiot.md V5.4, công tắc page_import, tắt sẵn). Chỉ lấy tên, ảnh đại diện, link, số người
// theo dõi (cập nhật mỗi ngày); KHÔNG kéo bài đăng hay video. Mỗi mạng dùng khoá của 9MUA trong .env (PAGEIMPORT_*);
// mạng chưa có khoá thì ẩn, người dùng vẫn gắn link tay như cũ. Máy E2E dùng driver giả.
export const IMPORT_NETWORKS = ['facebook', 'instagram', 'tiktok', 'youtube', 'zalo', 'shopee'] as const;
export type ImportNetwork = (typeof IMPORT_NETWORKS)[number];
export type PageInfo = {
  externalId: string;
  name: string;
  avatarUrl: string | null;
  url: string;
  followers: number;
};

const KEY: Record<ImportNetwork, string> = {
  facebook: 'PAGEIMPORT_FACEBOOK_TOKEN',
  instagram: 'PAGEIMPORT_INSTAGRAM_TOKEN',
  tiktok: 'PAGEIMPORT_TIKTOK_KEY',
  youtube: 'PAGEIMPORT_YOUTUBE_KEY',
  zalo: 'PAGEIMPORT_ZALO_TOKEN',
  shopee: 'PAGEIMPORT_SHOPEE_KEY',
};
// Mạng đã viết driver thật; mạng khác có khoá vẫn chờ (báo rõ ở trang Kết nối).
const REAL_DRIVERS: ImportNetwork[] = ['youtube', 'facebook'];

const fakeMode = () => process.env.TEST_MODE === 'e2e' || process.env.PAGEIMPORT_DRIVER === 'fake';

export function availableNetworks(): ImportNetwork[] {
  if (fakeMode()) return [...IMPORT_NETWORKS];
  return IMPORT_NETWORKS.filter((n) => REAL_DRIVERS.includes(n) && Boolean(process.env[KEY[n]]?.trim()));
}

const handleOf = (input: string) =>
  input
    .trim()
    .replace(/^https?:\/\/(www\.|m\.)?[^/]+\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
    .slice(0, 100);

// Driver giả: kết quả cố định theo tên nhập vào (đủ để thử luồng tick chọn / nhập / ngắt kết nối).
function fakeLookup(network: ImportNetwork, input: string): PageInfo[] {
  const h = handleOf(input) || 'trang';
  const seed = parseInt(createHash('sha1').update(`${network}:${h}`).digest('hex').slice(0, 6), 16);
  return [0, 1].map((i) => ({
    externalId: `${network}-${h}-${i}`,
    name: i ? `${h} Shop` : h,
    avatarUrl: null,
    url: `https://${network}.example/${h}${i ? '-shop' : ''}`,
    followers: (seed % 50_000) + i * 1000,
  }));
}

async function youtubeLookup(input: string, fetchImpl: typeof fetch): Promise<PageInfo[]> {
  const handle = handleOf(input);
  if (!handle) return [];
  const q = new URLSearchParams({
    part: 'snippet,statistics',
    forHandle: handle,
    key: process.env[KEY.youtube] ?? '',
  });
  const res = await fetchImpl(`https://www.googleapis.com/youtube/v3/channels?${q}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: {
      id: string;
      snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      statistics?: { subscriberCount?: string };
    }[];
  };
  return (data.items ?? []).map((c) => ({
    externalId: c.id,
    name: (c.snippet?.title ?? handle).slice(0, 100),
    avatarUrl: c.snippet?.thumbnails?.default?.url ?? null,
    url: `https://www.youtube.com/channel/${c.id}`,
    followers: Number(c.statistics?.subscriberCount ?? 0) || 0,
  }));
}

async function facebookLookup(input: string, fetchImpl: typeof fetch): Promise<PageInfo[]> {
  const handle = handleOf(input);
  if (!handle) return [];
  const q = new URLSearchParams({
    fields: 'id,name,link,fan_count,picture{url}',
    access_token: process.env[KEY.facebook] ?? '',
  });
  const res = await fetchImpl(`https://graph.facebook.com/v25.0/${encodeURIComponent(handle)}?${q}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const p = (await res.json()) as {
    id?: string;
    name?: string;
    link?: string;
    fan_count?: number;
    picture?: { data?: { url?: string } };
  };
  return p.id
    ? [
        {
          externalId: p.id,
          name: (p.name ?? handle).slice(0, 100),
          avatarUrl: p.picture?.data?.url ?? null,
          url: p.link ?? `https://www.facebook.com/${p.id}`,
          followers: p.fan_count ?? 0,
        },
      ]
    : [];
}

// Tìm Page / kênh theo link hoặc @tên. Lỗi gì cũng trả danh sách rỗng (không ghi log khoá).
export async function lookupPages(
  network: ImportNetwork,
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PageInfo[]> {
  if (!availableNetworks().includes(network)) return [];
  if (fakeMode()) return fakeLookup(network, input);
  try {
    if (network === 'youtube') return await youtubeLookup(input, fetchImpl);
    if (network === 'facebook') return await facebookLookup(input, fetchImpl);
  } catch {}
  return [];
}

// Nhập các Page đã tick. Chưa có Kiot thì tối đa 1 Page.
export async function importPages(
  userId: string,
  network: ImportNetwork,
  input: string,
  externalIds: string[],
  hasKiot: boolean,
): Promise<{ ok: true; imported: number } | { ok: false; error: 'NONE' | 'LIMIT' }> {
  const found = (await lookupPages(network, input)).filter((p) => externalIds.includes(p.externalId));
  if (!found.length) return { ok: false, error: 'NONE' };
  const existing = await db.pageImport.count({ where: { userId } });
  if (!hasKiot && existing + found.length > 1) return { ok: false, error: 'LIMIT' };
  for (const p of found)
    await db.pageImport.upsert({
      where: { userId_network_externalId: { userId, network, externalId: p.externalId } },
      create: {
        userId,
        network,
        externalId: p.externalId,
        name: p.name,
        avatarPath: p.avatarUrl,
        url: p.url,
        followers: p.followers,
        updatedAt: now(),
      },
      update: { name: p.name, avatarPath: p.avatarUrl, url: p.url, followers: p.followers, updatedAt: now() },
    });
  return { ok: true, imported: found.length };
}

export async function importedPages(userId: string) {
  return db.pageImport.findMany({ where: { userId }, orderBy: [{ network: 'asc' }, { followers: 'desc' }] });
}

// "Ngắt kết nối": xoá Page đã nhập của mạng đó (không lưu token người dùng nên không còn gì khác để xoá).
export async function disconnectNetwork(userId: string, network: ImportNetwork): Promise<number> {
  return (await db.pageImport.deleteMany({ where: { userId, network } })).count;
}

// Việc hằng ngày: cập nhật số người theo dõi.
export async function refreshImportedPages(): Promise<number> {
  const rows = await db.pageImport.findMany({ orderBy: { updatedAt: 'asc' }, take: 500 });
  let n = 0;
  for (const r of rows) {
    const net = r.network as ImportNetwork;
    const fresh = (await lookupPages(net, r.url)).find((p) => p.externalId === r.externalId);
    if (!fresh) continue;
    await db.pageImport.update({
      where: { id: r.id },
      data: { followers: fresh.followers, name: fresh.name, updatedAt: now() },
    });
    n += 1;
  }
  return n;
}
