import { MapPin, Phone, Mail, Building2, Store } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { POLICY_SLUGS } from '@/content/legal';
import { getT } from '@/i18n/server';
import { getLegalInfo } from '@/lib/legal';
import { mapUrl } from '@/server/legal-page';

export const metadata: Metadata = {
  title: 'Giới thiệu & Pháp lý',
  description:
    '9MUA CO.,LTD — sàn thương mại điện tử Kiot + Chợ 9MUA. Thông tin công ty và chính sách của sàn.',
};

// Trang Giới thiệu & Pháp lý (SPEC-marketplace.md bổ sung 27/10, giao diện theo V4 trang 10). Không vẽ con dấu, không
// hiện số tài khoản cá nhân; thông tin công ty do CEO sửa ở /admin/noi-dung.
export default async function AboutPage() {
  const [t, legal] = await Promise.all([getT(), getLegalInfo()]);
  const rows = [
    {
      Icon: Building2,
      label: t('legal.company'),
      value: `${legal.company} · ${t('legal.taxId')} ${legal.taxId}`,
    },
    { Icon: MapPin, label: t('legal.office'), value: legal.office, map: legal.office },
    { Icon: Store, label: t('legal.showroom'), value: legal.showroom, map: legal.showroom },
    { Icon: Phone, label: t('legal.hotline'), value: legal.hotline, href: `tel:${legal.hotline}` },
    { Icon: Mail, label: t('legal.email'), value: legal.email, href: `mailto:${legal.email}` },
  ];
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 py-6">
      <section className="rounded-[24px] border border-white/10 bg-gradient-to-br from-brand/30 via-white/5 to-cyan-600/20 p-5">
        <p className="text-[12px] font-black text-brand">{t('legal.title').toUpperCase()}</p>
        <h1 className="mt-2 font-display text-[22px] font-black leading-tight md:text-[28px]">
          {t('common.slogan.legal')}
        </h1>
        <div className="mt-3 flex flex-col gap-2 text-[14px] text-white/80">
          <p>{t('legal.about.p1')}</p>
          <p>{t('legal.about.p2')}</p>
          <p>{t('legal.about.p3')}</p>
        </div>
      </section>

      <section
        className="divide-y divide-white/10 rounded-[18px] border border-white/10 bg-white/5"
        data-testid="company-info"
      >
        {rows.map(({ Icon, label, value, ...x }) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase text-white/50">{label}</p>
              {'href' in x && x.href ? (
                <a href={x.href} className="text-[14px] font-bold hover:text-brand">
                  {value}
                </a>
              ) : (
                <p className="text-[14px] font-bold">{value}</p>
              )}
              {'map' in x && x.map ? (
                <a
                  href={mapUrl(x.map)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-bold text-brand"
                >
                  {t('legal.map')} →
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-[15px] font-black">{t('legal.policies')}</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="policy-links">
          {POLICY_SLUGS.map((slug) => (
            <li key={slug}>
              <Link
                href={`/chinh-sach/${slug}`}
                className="flex h-12 items-center rounded-[14px] border border-white/10 bg-white/5 px-4 text-[14px] font-bold hover:border-brand"
              >
                {t(`legal.policy.${slug}`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
