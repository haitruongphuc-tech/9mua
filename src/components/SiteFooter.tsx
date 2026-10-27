import { getT } from '@/i18n/server';

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="border-t border-white/10 bg-ink">
      <div className="mx-auto max-w-[1200px] px-4 py-6 text-[12px] text-white/50 md:px-6">
        <p className="font-bold text-white/80">9MUA CO.,LTD</p>
        <p>{t('common.footer.taxId')} 3401295437 · 115 Nguyễn Hậu, P. Phú Thọ Hòa, TP.HCM</p>
      </div>
    </footer>
  );
}
