import type { Metadata } from 'next';
import Link from 'next/link';
import QRCode from 'qrcode';
import { getT } from '@/i18n/server';
import { now } from '@/lib/clock';
import { env } from '@/lib/env';
import { kiotOrigin } from '@/lib/urls';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, kiotStatus } from '@/modules/kiot';
import { getKiotFee } from '@/modules/billing';
import { formatDateVN, formatVnd } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { startKiotPaymentAction } from './thanh-toan/actions';

export const metadata: Metadata = { title: 'Kiot của tôi', robots: { index: false } };

const card = 'rounded-[18px] border border-white/10 bg-white/5 p-4 font-bold hover:border-brand';

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ 'moi-tao'?: string; 'loi-thanh-toan'?: string }>;
}) {
  const user = await requireUser();
  const [kiot, t] = await Promise.all([getKiotByOwner(user.id), getT()]);
  if (!kiot) {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-12 text-center">
        <h1 className="font-display text-[22px] font-black">{t('seller.none.title')}</h1>
        <p className="max-w-sm text-white/70">{t('seller.none.text')}</p>
        <Link
          href="/kiot-cua-toi/tao"
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[14px] font-black"
        >
          {t('seller.none.create')}
        </Link>
      </section>
    );
  }

  const status = kiotStatus(kiot);
  const url = kiotOrigin(kiot.slug);
  const [qrSvg, params, fee] = await Promise.all([
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    searchParams,
    getKiotFee(),
  ]);
  const justCreated = Boolean(params['moi-tao']);
  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      {justCreated ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('seller.dash.created')}
        </p>
      ) : null}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[22px] font-black">{kiot.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-[13px] text-white/70" data-testid="kiot-url">
            {kiot.slug}.{env().ROOT_DOMAIN}
          </span>
        </div>
        {kiot.activeUntil && status !== 'locked' ? (
          <p className="text-[13px] text-white/70">
            {t(status === 'active' ? 'seller.dash.activeUntil' : 'seller.dash.expiredOn', {
              date: formatDateVN(kiot.activeUntil),
            })}
          </p>
        ) : null}
        {status === 'locked' ? (
          <p className="text-[13px] text-red-400">
            {kiot.lockReason
              ? t('seller.dash.lockedReason', { reason: kiot.lockReason })
              : t('seller.dash.locked')}
          </p>
        ) : null}
      </header>
      {status === 'active' &&
      kiot.activeUntil &&
      kiot.activeUntil.getTime() - now().getTime() <= 14 * 86_400_000 ? (
        <p
          role="alert"
          data-testid="expiry-banner"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {t('seller.dash.expiring', { date: formatDateVN(kiot.activeUntil) })}
        </p>
      ) : null}
      {status !== 'locked' ? (
        <form
          action={startKiotPaymentAction}
          className="flex flex-col gap-2 rounded-[18px] border border-brand/40 bg-brand/10 p-4"
        >
          <p className="text-[13px]">
            {t(
              status === 'draft'
                ? 'seller.dash.draftHint'
                : status === 'expired'
                  ? 'seller.dash.expiredHint'
                  : 'seller.dash.renewHint',
            )}
          </p>
          <button
            type="submit"
            data-testid="activate-kiot"
            className="h-12 rounded-full bg-brand font-black text-white shadow-[0_0_20px_rgb(255_107_0/0.35)]"
          >
            {t(status === 'draft' ? 'seller.dash.activate' : 'seller.dash.renew', { fee: formatVnd(fee) })}
          </button>
          {params['loi-thanh-toan'] ? (
            <p className="text-[13px] text-red-400">{t('seller.dash.payFailed')}</p>
          ) : null}
        </form>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/kiot-cua-toi/san-pham" className={card}>
          {t('seller.dash.manageProducts')}
        </Link>
        <Link href="/video/dang" className={card}>
          {t('seller.dash.postVideo')}
        </Link>
        <a href={url} className={card}>
          {t('seller.dash.viewKiot')}
        </a>
      </div>
      <div className="flex items-center gap-4 rounded-[18px] border border-white/10 bg-white/5 p-4">
        {/* SVG do thư viện qrcode tạo từ URL của chính Kiot, không chứa dữ liệu người dùng nhập. */}
        <div
          className="h-28 w-28 shrink-0 rounded-[12px] bg-white p-1"
          aria-label={t('seller.dash.qrAlt', { url })}
          role="img"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-2">
          <p className="font-bold">{t('seller.dash.qrTitle')}</p>
          <p className="text-[13px] text-white/70">{t('seller.dash.qrText')}</p>
          <a
            href="/api/kiot/qr"
            className="self-start rounded-full border border-white/25 px-4 py-1.5 text-[13px] font-bold"
            download
          >
            {t('seller.dash.qrDownload')}
          </a>
        </div>
      </div>
    </section>
  );
}
