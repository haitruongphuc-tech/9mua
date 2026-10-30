import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLang, getT } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/modules/identity';
import { listBlocked, listConversations } from '@/modules/messages';
import { unblockAction } from './actions';
import { Avatar } from '@/components/ui/Avatar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Hộp thư', robots: { index: false } };

const ERRORS = ['SELF', 'NOT_FOUND', 'BLOCKED', 'BANNED', 'FREE_LIMIT', 'NEW_ACCOUNT'] as const;

// Hộp thư (SPEC-messages.md mục 1): cuộc trò chuyện mới nhất trước, tab "Tin nhắn chờ" cho tin của người lạ.
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ muc?: string; loi?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/dang-nhap?next=%2Fhop-thu');
  const [t, lang, params] = await Promise.all([getT(), getLang(), searchParams]);
  const folder = params.muc === 'cho' ? 'requests' : 'inbox';
  const [list, requests, blocked] = await Promise.all([
    listConversations(user.id, folder),
    listConversations(user.id, 'requests'),
    listBlocked(user.id),
  ]);
  const error = ERRORS.find((e) => e === params.loi);
  const tab = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold ${active ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`;
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-5">
      <h1 className="font-display text-[22px] font-black">{t('inbox.title')}</h1>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
          data-testid="inbox-error"
        >
          {t(`inbox.err.${error}`)}
        </p>
      ) : null}
      <nav className="mt-4 flex gap-2" aria-label={t('inbox.title')}>
        <Link
          href="/hop-thu"
          className={tab(folder === 'inbox')}
          aria-current={folder === 'inbox' ? 'page' : undefined}
        >
          {t('inbox.tab.inbox')}
        </Link>
        <Link
          href="/hop-thu?muc=cho"
          className={tab(folder === 'requests')}
          aria-current={folder === 'requests' ? 'page' : undefined}
          data-testid="inbox-tab-requests"
        >
          {t('inbox.tab.requests')}
          {requests.length ? ` (${requests.length})` : ''}
        </Link>
      </nav>
      {list.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-white/60" data-testid="inbox-empty">
          {t(folder === 'requests' ? 'inbox.emptyRequests' : 'inbox.empty')}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10 rounded-[18px] border border-white/10 bg-white/5">
          {list.map((c) => {
            const name = c.other.kiotName ?? c.other.displayName;
            const preview =
              c.last.kind === 'hidden'
                ? t('inbox.hiddenMsg')
                : c.last.kind === 'image'
                  ? t('inbox.image')
                  : c.last.kind === 'product'
                    ? t('inbox.product')
                    : c.last.kind === 'video'
                      ? t('inbox.video')
                      : (c.last.text ?? '');
            return (
              <li key={c.id}>
                <Link
                  href={`/hop-thu/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5"
                  data-testid="inbox-item"
                >
                  <Avatar name={name} url={c.other.avatarUrl} className="h-11 w-11 text-[16px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[14px] ${c.unread ? 'font-black' : 'font-bold'}`}>
                        {name}
                      </span>
                      <span className="shrink-0 text-[11px] text-white/50">
                        {formatDate(new Date(c.lastMessageAt), lang)}
                      </span>
                    </span>
                    <span
                      className={`block truncate text-[13px] ${c.unread ? 'text-white' : 'text-white/60'}`}
                    >
                      {c.last.fromMe ? t('inbox.you') : ''}
                      {preview}
                    </span>
                  </span>
                  {c.unread ? (
                    <span
                      className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-black"
                      data-testid="inbox-unread"
                    >
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <details className="mt-6 text-[13px] text-white/70">
        <summary className="cursor-pointer font-bold">{t('inbox.blockedList')}</summary>
        {blocked.length === 0 ? (
          <p className="mt-2 text-white/50">{t('inbox.noBlocked')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3">
                <span>{b.displayName}</span>
                <form action={unblockAction.bind(null, b.id)}>
                  <button type="submit" className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold">
                    {t('inbox.unblock')}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
