import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, MAX_IMAGES_PER_PRODUCT } from '@/modules/kiot';
import { createProductAction } from '../actions';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Thêm sản phẩm', robots: { index: false } };

export default async function NewProductPage() {
  const user = await requireUser();
  if (!(await getKiotByOwner(user.id))) redirect('/kiot-cua-toi/tao');
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Thêm sản phẩm</h1>
      <ProductForm
        action={createProductAction}
        submitLabel="Đăng sản phẩm"
        maxImages={MAX_IMAGES_PER_PRODUCT}
      />
    </section>
  );
}
