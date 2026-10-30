import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { CreatorProfileView } from '@/components/profile/CreatorProfileView';
import { isFeatureOn } from '@/lib/features';
import { getCreatorProfile } from '@/modules/creator';
import { ensureHandle } from '@/modules/identity';

const load = cache(getCreatorProfile);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const p = await load((await params).userId);
  if (!p) return { title: 'Không tìm thấy creator', robots: { index: false } };
  return { title: `${p.displayName} – Creator`, description: `${p.videoCount} video trên 9MUA.` };
}

// Link cũ /creator/<id>: khi bật @tên (SPEC-identity.md V5.1) chuyển hẳn sang 9mua.com/@<tên>; tắt thì hiện như cũ.
export default async function CreatorPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const p = await load(userId);
  if (!p) notFound();
  if (await isFeatureOn('account_more')) {
    const handle = await ensureHandle(p.id);
    if (handle) permanentRedirect(`/@${handle}`);
  }
  return <CreatorProfileView profile={p} handle={null} />;
}
