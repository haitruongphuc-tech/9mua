import { db } from '@/lib/db';

// Social Connect bản thật (SPEC-kiot.md bổ sung 27/10): người dùng dán link trang của mình; kiểm đúng tên miền.
export const PLATFORMS = {
  tiktok: ['tiktok.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  shopee: ['shopee.vn', 'shopee.com', 'shp.ee'],
  zalo: ['zalo.me', 'oa.zalo.me'],
} as const;
export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_LIST = Object.keys(PLATFORMS) as Platform[];

export function normalizeSocialUrl(platform: Platform, raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|vt|vm)\./, '');
  if (!PLATFORMS[platform].some((d) => host === d || host.endsWith(`.${d}`))) return null;
  url.protocol = 'https:';
  url.hash = '';
  return url.toString().slice(0, 300);
}

export async function setSocialLinks(
  userId: string,
  input: Partial<Record<Platform, string>>,
): Promise<{ ok: true } | { ok: false; invalid: Platform[] }> {
  const invalid: Platform[] = [];
  const values: [Platform, string | null][] = [];
  for (const p of PLATFORM_LIST) {
    const raw = input[p] ?? '';
    if (!raw.trim()) values.push([p, null]);
    else {
      const url = normalizeSocialUrl(p, raw);
      if (url) values.push([p, url]);
      else invalid.push(p);
    }
  }
  if (invalid.length) return { ok: false, invalid };
  await db.$transaction(
    values.map(([platform, url]) =>
      url
        ? db.socialLink.upsert({
            where: { userId_platform: { userId, platform } },
            create: { userId, platform, url },
            update: { url },
          })
        : db.socialLink.deleteMany({ where: { userId, platform } }),
    ),
  );
  return { ok: true };
}

export async function getSocialLinks(userId: string): Promise<Partial<Record<Platform, string>>> {
  const rows = await db.socialLink.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [r.platform, r.url]));
}
