import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import type { MessageKey } from '@/i18n/messages';
import { formatDateTime } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getXuBalance, getXuHistory, getXuRules } from '@/modules/xu';

export const metadata: Metadata = { title: 'Xu', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Xu của tôi (SPEC-live.md phần 2 mục 8): số dư, lịch sử từng dòng, luật thưởng.
export default async function XuPage() {
  const user = await requireUser();
  const [t, balance, history, rules] = await Promise.all([
    getT(),
    getXuBalance(user.id),
    getXuHistory(user.id, null, 50),
    getXuRules(),
  ]);
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('live.xu.title')}</h1>
      <div className="rounded-[24px] bg-gradient-to-br from-yellow-400 to-brand p-5 text-black">
        <p className="text-[12px] font-bold">{t('live.xu.tile')}</p>
        <p className="text-[36px] font-black leading-tight" data-testid="xu-balance">
          {t('live.xu.unit', { count: balance.toLocaleString(t.lang) })}
        </p>
        <p className="mt-1 text-[12px] font-medium">{t('live.xu.what')}</p>
      </div>
      <section className="rounded-[18px] border border-white/10 bg-white/5 p-4">
        <h2 className="text-[15px] font-black">{t('live.xu.rules')}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-[13px] text-white/80">
          {rules.tiers.map(([viewers, xu]) => (
            <li key={viewers}>• {t('live.xu.rule.tier', { viewers, xu })}</li>
          ))}
          <li>• {t('live.xu.rule.min', { minutes: rules.minMinutes })}</li>
          <li>• {t('live.xu.rule.viewer')}</li>
        </ul>
        <Link href="/live/phat" className="mt-3 inline-block text-[13px] font-bold text-brand">
          {t('live.go')} →
        </Link>
      </section>
      <section>
        <h2 className="text-[15px] font-black">{t('live.xu.history')}</h2>
        {history.items.length === 0 ? (
          <p className="mt-2 text-[13px] text-white/60">{t('live.xu.empty')}</p>
        ) : (
          <ul
            className="mt-2 divide-y divide-white/10 rounded-[18px] border border-white/10 bg-white/5"
            data-testid="xu-history"
          >
            {history.items.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <span className="min-w-0">
                  <span className="block font-bold">{t(`live.xu.kind.${e.kind}` as MessageKey)}</span>
                  <span className="block text-[11px] text-white/50">
                    {formatDateTime(e.createdAt, t.lang)}
                    {e.kind === 'admin_revoke' && e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 font-black ${e.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {e.amount > 0 ? '+' : ''}
                  {e.amount.toLocaleString(t.lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
