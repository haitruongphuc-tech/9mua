import Link from 'next/link';
import { getT } from '@/i18n/server';
import { cached } from '@/lib/ttl-cache';
import { trendingHashtags } from '@/modules/social';

// Hàng "Hashtag nổi bật" của Chợ (SPEC-social.md mục 5): 10 hashtag nhiều video nhất 7 ngày qua.
export async function HashtagRow() {
  const tags = await cached('social:trending-hashtags', 60, () => trendingHashtags(10));
  if (tags.length === 0) return null;
  const t = await getT();
  return (
    <section className="flex flex-col gap-2" data-testid="trending-hashtags">
      <h2 className="text-[15px] font-black">{t('feed.hashtag.trending')}</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {tags.map((x) => (
          <Link
            key={x.tag}
            href={`/hashtag/${encodeURIComponent(x.tag)}`}
            className="shrink-0 rounded-full border border-brand/30 bg-brand-cream px-3 py-1.5 text-[13px] font-bold text-brand"
          >
            #{x.tag} <span className="font-normal text-brand/70">· {x.videos}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
