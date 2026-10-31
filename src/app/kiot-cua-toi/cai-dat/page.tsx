import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { requireUser } from '@/modules/identity';
import { BANKS, getKiotByOwner, getPayoutAccount } from '@/modules/kiot';
import { updateKiotAction } from '../actions';
import { KiotForm } from '../KiotForm';
import { AddressForm } from './AddressForm';
import { LocationForm } from './LocationForm';
import { BrandingForm } from './BrandingForm';
import { PayoutAccountForm } from './PayoutAccountForm';
import { ShippingForm } from './ShippingForm';

export const metadata: Metadata = { title: 'Cài đặt Kiot', robots: { index: false } };

const card = 'rounded-[18px] border border-white/10 bg-white/5 p-5';
const heading = 'mb-4 font-display text-[16px] font-black';

export default async function KiotSettingsPage() {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const [payout, t] = await Promise.all([getPayoutAccount(kiot.id), getT()]);
  return (
    <section className="flex flex-col gap-6 px-4 py-6">
      <div className={card}>
        <h1 className={heading}>{t('seller.settings.info')}</h1>
        <KiotForm
          action={updateKiotAction}
          rootDomain={env().ROOT_DOMAIN}
          slugLocked={kiot.activeUntil !== null}
          submitLabel={t('seller.settings.saveInfo')}
          initial={{
            name: kiot.name,
            slug: kiot.slug,
            description: kiot.description,
            contactPhone: '0' + kiot.contactPhone.slice(3),
          }}
        />
      </div>
      <div className={card}>
        <h2 className={heading}>{t('seller.settings.branding')}</h2>
        <BrandingForm logoUrl={kiot.logoUrl} coverUrl={kiot.coverUrl} />
      </div>
      <div className={card}>
        <h2 className={heading}>{t('seller.settings.address')}</h2>
        <AddressForm
          initial={{
            province: kiot.province ?? '',
            district: kiot.district ?? '',
            addressLine: kiot.addressLine ?? '',
          }}
        />
      </div>
      <div className={card} id="vi-tri">
        <h2 className={heading}>{t('seller.loc.title')}</h2>
        <LocationForm pinned={kiot.lat !== null} showExact={kiot.showExactLocation} />
      </div>
      <div className={card}>
        <h2 className={heading}>{t('seller.settings.shipping')}</h2>
        <ShippingForm shippingFee={kiot.shippingFee} freeShippingThreshold={kiot.freeShippingThreshold} />
      </div>
      <div className={card}>
        <h2 className={heading}>{t('seller.settings.payout')}</h2>
        <PayoutAccountForm banks={BANKS} current={payout} />
      </div>
    </section>
  );
}
