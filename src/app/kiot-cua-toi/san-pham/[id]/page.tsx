import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { getProductForOwner, MAX_IMAGES_PER_PRODUCT } from '@/modules/kiot';
import { deleteProductAction, updateProductAction } from '../actions';
import { ProductForm } from '../ProductForm';
import { DeleteButton } from './DeleteButton';

export const metadata: Metadata = { title: 'Sửa sản phẩm', robots: { index: false } };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const product = await getProductForOwner(user.id, (await params).id);
  if (!product) notFound();
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Sửa sản phẩm</h1>
      {product.hiddenByAdminAt ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          Sản phẩm đã bị 9MUA gỡ khỏi Chợ{product.hiddenReason ? `: ${product.hiddenReason}` : ''}.
        </p>
      ) : null}
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        submitLabel="Lưu thay đổi"
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
      <DeleteButton action={deleteProductAction.bind(null, product.id)} />
    </section>
  );
}
