import { getT } from '@/i18n/server';
import { getLegalInfo } from '@/lib/legal';

// Chân trang V4: thông tin công ty do CEO sửa ở /admin/noi-dung.
export async function SiteFooter() {
  const [t, legal] = await Promise.all([getT(), getLegalInfo()]);
  return (
    <footer className="border-t border-white/10 bg-ink">
      <div className="mx-auto max-w-[1200px] px-4 py-6 text-[12px] text-white/50 md:px-6">
        <p className="font-bold text-white/80">{legal.company}</p>
        <p>
          {t('common.footer.taxId')} {legal.taxId} · {legal.office}
        </p>
      </div>
    </footer>
  );
}
