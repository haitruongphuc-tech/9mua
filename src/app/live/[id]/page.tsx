import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LiveFeed } from '@/components/live/LiveFeed';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { readAnonId } from '@/lib/anon-id';
import { getCurrentUser } from '@/modules/identity';
import { getLiveForViewer } from '@/modules/live';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await getLiveForViewer((await params).id, {});
  return { title: view && 'title' in view ? `LIVE · ${view.title}` : 'Live', robots: { index: false } };
}

// Link chia sẻ 9mua.com/live/<id>: còn live thì mở thẳng; đã kết thúc thì báo kèm link trang người phát.
export default async function LiveOnePage({ params }: Props) {
  const { id } = await params;
  const [t, user, anonId] = await Promise.all([getT(), getCurrentUser(), readAnonId()]);
  const view = await getLiveForViewer(id, { userId: user?.id, anonId });
  if (!view) notFound();
  if (view.kind !== 'live') {
    return (
      <div
        className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-20 text-center"
        data-testid="live-ended"
      >
        <h1 className="font-display text-[22px] font-black">
          {t(view.kind === 'ended' ? 'live.ended.title' : 'live.full.title')}
        </h1>
        {view.kind === 'ended' ? (
          <a
            href={view.host.href}
            className="h-11 rounded-full bg-brand px-6 text-[14px] font-black leading-[44px]"
          >
            {t('live.ended.host', { name: view.host.kiot?.name ?? view.host.displayName })}
          </a>
        ) : (
          <Link
            href="/live"
            className="h-11 rounded-full bg-brand px-6 text-[14px] font-black leading-[44px]"
          >
            {t('live.full.other')}
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[560px] px-3 py-4">
      <ClientMessages prefixes={['live.', 'shop.cart.']}>
        <LiveFeed lives={[view]} loggedIn={Boolean(user)} />
      </ClientMessages>
    </div>
  );
}
