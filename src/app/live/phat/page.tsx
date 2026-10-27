import type { Metadata } from 'next';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getIntSetting } from '@/lib/settings';
import { requireUser } from '@/modules/identity';
import { myOpenLive } from '@/modules/live';
import { PublishStudio } from './PublishStudio';

export const metadata: Metadata = { title: 'Phát live', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Mọi tài khoản đăng nhập đều phát được (SPEC-live.md mục 1); luật 3 ngày tuổi, số buổi, cấm live kiểm ở máy chủ.
export default async function PublishPage() {
  const user = await requireUser();
  const [open, maxMinutes] = await Promise.all([myOpenLive(user.id), getIntSetting('live_max_minutes')]);
  return (
    <div className="mx-auto max-w-[560px] px-3 py-4">
      <ClientMessages prefixes={['live.']}>
        <PublishStudio openLiveId={open?.id ?? null} maxMinutes={maxMinutes} />
      </ClientMessages>
    </div>
  );
}
