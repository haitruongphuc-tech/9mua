import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { createKiotAction } from '../actions';
import { KiotForm } from '../KiotForm';

export const metadata: Metadata = { title: 'Tạo Kiot', robots: { index: false } };

export default async function CreateKiotPage() {
  const user = await requireUser();
  if (await getKiotByOwner(user.id)) redirect('/kiot-cua-toi');
  return (
    <section className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="mb-1 text-2xl font-extrabold">Tạo Kiot của bạn</h1>
      <p className="mb-6 text-black/70">
        Tạo miễn phí và đăng sản phẩm trước. Kiot hiện công khai sau khi kích hoạt 26.000đ/năm.
      </p>
      <KiotForm action={createKiotAction} rootDomain={env().ROOT_DOMAIN} submitLabel="Tạo Kiot" />
    </section>
  );
}
