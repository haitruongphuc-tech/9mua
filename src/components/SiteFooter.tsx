import Link from 'next/link';
import { POLICY_SLUGS } from '@/content/legal';
import { getT } from '@/i18n/server';
import { getLegalInfo } from '@/lib/legal';

// Chân trang V4: thông tin công ty do CEO sửa ở /admin/noi-dung, link Giới thiệu & các trang chính sách.
export async function SiteFooter() {
  const [t, legal] = await Promise.all([getT(), getLegalInfo()]);
  return (
    <footer className="border-t border-white/10 bg-ink">
      <div className="mx-auto max-w-[1200px] px-4 py-6 text-[12px] text-white/50 md:px-6">
        <p className="font-bold text-white/80">{legal.company}</p>
        <p>
          {t('common.footer.taxId')} {legal.taxId} · {legal.office}
        </p>
        <nav
          aria-label={t('legal.policies')}
          className="mt-3 flex flex-wrap gap-x-4 gap-y-1"
          data-testid="footer-links"
        >
          <Link href="/gioi-thieu" className="hover:text-white">
            {t('legal.title')}
          </Link>
          {POLICY_SLUGS.map((slug) => (
            <Link key={slug} href={`/chinh-sach/${slug}`} className="hover:text-white">
              {t(`legal.policy.${slug}`)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
