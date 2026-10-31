import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { getProductForOwner, MAX_IMAGES_PER_PRODUCT } from '@/modules/kiot';
import { deleteProductAction, updateProductAction } from '../actions';
import { ProductForm } from '../ProductForm';
import { DeleteButton } from './DeleteButton';
import { setProductWarrantyAction } from '../../warranty-actions';
import { isFeatureOn } from '@/lib/features';

export const metadata: Metadata = { title: 'Sửa sản phẩm', robots: { index: false } };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [product, t] = await Promise.all([getProductForOwner(user.id, (await params).id), getT()]);
  if (!product) notFound();
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.pedit.title')}</h1>
      {product.hiddenByAdminAt ? (
        <p role="alert" className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300">
          {product.hiddenReason
            ? t('seller.pedit.removedReason', { reason: product.hiddenReason })
            : t('seller.pedit.removed')}
        </p>
      ) : null}
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        submitLabel={t('seller.pedit.save')}
        maxImages={MAX_IMAGES_PER_PRODUCT}
        initial={{
          name: product.name,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          stock: product.stock,
          category: product.category,
          visible: product.visible,
          images: product.images.map((i) => ({ id: i.id, thumbUrl: i.thumbUrl })),
        }}
      />
      {(await isFeatureOn('kiot_builder')) ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-white/70">{t('seller.warranty.title')}</h2>
          <form action={setProductWarrantyAction.bind(null, product.id)} className="flex gap-2">
            <input
              name="warranty"
              maxLength={60}
              defaultValue={product.warranty ?? ''}
              placeholder={t('seller.warranty.hint')}
              className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 px-3 text-[14px]"
              data-testid="product-warranty-input"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-full bg-white/10 px-4 text-[13px] font-black"
            >
              {t('seller.warranty.save')}
            </button>
          </form>
        </section>
      ) : null}
      <DeleteButton action={deleteProductAction.bind(null, product.id)} />
    </section>
  );
}
