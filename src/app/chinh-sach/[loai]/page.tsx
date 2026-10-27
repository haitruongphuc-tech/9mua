import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fillPolicy, isPolicySlug, policyFor, POLICY_SLUGS, POLICY_UPDATED } from '@/content/legal';
import { getT } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import { policyValues } from '@/server/legal-page';

type Props = { params: Promise<{ loai: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { loai } = await params;
  if (!isPolicySlug(loai)) return {};
  const { doc } = policyFor(loai, 'vi');
  return { title: doc.title, description: doc.summary };
}

// 7 trang chính sách của sàn (SPEC-marketplace.md bổ sung 27/10). Bản tiếng Việt là bản chính thức.
export default async function PolicyPage({ params }: Props) {
  const { loai } = await params;
  if (!isPolicySlug(loai)) notFound();
  const [t, values] = await Promise.all([getT(), policyValues()]);
  const { doc: raw, fallback } = policyFor(loai, t.lang);
  const doc = fillPolicy(raw, values);
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 py-6">
      <nav className="text-[12px] font-bold text-white/60">
        <Link href="/gioi-thieu" className="hover:text-brand">
          {t('legal.title')}
        </Link>
      </nav>
      <header>
        <h1 className="font-display text-[22px] font-black leading-tight md:text-[28px]">{doc.title}</h1>
        <p className="mt-1 text-[14px] text-white/70">{doc.summary}</p>
        <p className="mt-1 text-[12px] text-white/50">
          {t('legal.updated', { date: formatDate(POLICY_UPDATED, t.lang) })}
          {t.lang !== 'vi' && !fallback ? ` · ${t('legal.official')}` : ''}
        </p>
        {fallback ? (
          <p
            className="mt-3 rounded-[14px] bg-white/10 px-4 py-2 text-[13px] font-bold"
            data-testid="policy-fallback"
          >
            {t('legal.fallback')}
          </p>
        ) : null}
      </header>
      <article className="flex flex-col gap-4" data-testid="policy">
        {doc.sections.map((s) => (
          <section key={s.heading} className="rounded-[18px] border border-white/10 bg-white/5 p-4">
            <h2 className="text-[16px] font-black">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-2 text-[14px] leading-relaxed text-white/80">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
      <nav aria-label={t('legal.policies')} className="flex flex-wrap gap-2">
        {POLICY_SLUGS.filter((s) => s !== loai).map((slug) => (
          <Link
            key={slug}
            href={`/chinh-sach/${slug}`}
            className="h-8 rounded-full border border-white/15 px-3.5 text-[12px] font-bold leading-8 hover:border-brand"
          >
            {t(`legal.policy.${slug}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
