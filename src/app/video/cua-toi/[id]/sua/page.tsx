import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { videoForEdit } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { PROVINCES } from '@/modules/kiot';
import { EditVideoForm } from './EditVideoForm';

export const metadata: Metadata = { title: 'Sửa video', robots: { index: false } };

// Sửa sau khi đăng (SPEC-creator.md V5.3 mục 7): không sửa file video.
export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!(await isFeatureOn('post_options'))) notFound();
  const video = await videoForEdit(user.id, (await params).id);
  if (!video) notFound();
  const t = await getT();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-bold">{t('post.editTitle')}</h1>
      <p className="text-[13px] text-white/60">{t('post.editLead')}</p>
      <ClientMessages prefixes={['post.']}>
        <EditVideoForm video={video} provinces={PROVINCES.map((p) => ({ slug: p.slug, name: p.name }))} />
      </ClientMessages>
    </div>
  );
}
