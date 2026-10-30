import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { CreatorProfileView } from '@/components/profile/CreatorProfileView';
import { isFeatureOn } from '@/lib/features';
import { getCreatorProfile } from '@/modules/creator';
import { resolveHandle } from '@/modules/identity';

// Trang cá nhân 9mua.com/@<tên> (SPEC-identity.md V5.1). Middleware viết lại /@<tên> thành /u/<tên> vì thư mục bắt đầu
// bằng "@" trong app router là "slot", không dùng làm đường dẫn được.
const load = cache(async (raw: string) => {
  if (!(await isFeatureOn('account_more'))) return null;
  const found = await resolveHandle(raw);
  if (!found) return null;
  if ('redirectTo' in found) return found;
  const profile = await getCreatorProfile(found.userId);
  return profile ? { profile } : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const r = await load((await params).handle);
  if (!r || !('profile' in r)) return { title: 'Không tìm thấy', robots: { index: false } };
  return {
    title: `${r.profile.displayName} – Creator`,
    description: `${r.profile.videoCount} video trên 9MUA.`,
  };
}

export default async function HandlePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const r = await load(handle);
  if (!r) notFound();
  // @tên cũ trong 30 ngày: chuyển sang @tên mới.
  if ('redirectTo' in r) permanentRedirect(`/@${r.redirectTo}`);
  return (
    <CreatorProfileView
      profile={r.profile}
      handle={decodeURIComponent(handle).replace(/^@/, '').toLowerCase()}
    />
  );
}
