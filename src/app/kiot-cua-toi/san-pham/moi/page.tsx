import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, MAX_IMAGES_PER_PRODUCT } from '@/modules/kiot';
import { createProductAction } from '../actions';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Thêm sản phẩm', robots: { index: false } };

export default async function NewProductPage() {
  const user = await requireUser();
  if (!(await getKiotByOwner(user.id))) redirect('/kiot-cua-toi/tao');
  const t = await getT();
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.pnew.title')}</h1>
      <ProductForm
        action={createProductAction}
        submitLabel={t('seller.pnew.submit')}
        maxImages={MAX_IMAGES_PER_PRODUCT}
      />
    </section>
  );
}
