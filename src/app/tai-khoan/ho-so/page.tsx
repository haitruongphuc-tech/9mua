import type { Metadata } from 'next';
import Link from 'next/link';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { getPublicProfile, requireUser } from '@/modules/identity';
import { ProfileForm } from '../AccountForms';
import { ProfileImagesForm } from './ProfileImagesForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('profile.edit.title'), robots: { index: false } };
}

// Sửa hồ sơ (SPEC-social.md bổ sung 30/10, A2): ảnh đại diện, ảnh bìa, tên hiển thị, giới thiệu.
export default async function EditProfilePage() {
  const user = await requireUser();
  const [t, profile] = await Promise.all([getT(), getPublicProfile(user.id)]);
  return (
    <ClientMessages prefixes={['profile.edit.', 'me.settings.', 'seller.img.']}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <Link href={`/creator/${user.id}`} className="text-[13px] font-bold text-white/60">
          {t('profile.edit.back')}
        </Link>
        <h1 className="font-display text-[22px] font-black">{t('profile.edit.title')}</h1>
        <ProfileImagesForm
          name={user.displayName}
          avatarUrl={profile?.avatarUrl ?? null}
          coverUrl={profile?.coverUrl ?? null}
        />
        <ProfileForm displayName={user.displayName} bio={profile?.bio ?? null} />
      </div>
    </ClientMessages>
  );
}
