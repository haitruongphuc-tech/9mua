import { Lock, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { AI_STYLES, aiQuota, aiStatus, isStudioOwner } from '@/modules/ai';
import { getCurrentUser } from '@/modules/identity';
import { CATEGORIES } from '@/modules/kiot';
import { AiStudio } from './AiStudio';

export const metadata: Metadata = { title: 'AI Studio', robots: { index: false } };
export const dynamic = 'force-dynamic';

// AI Studio (SPEC-ai.md, giao diện theo V4 trang 09). Khung gradient, 5 phong cách, 4 ảnh, video 10 giây, đọc 7 thứ
// tiếng. Chỉ chủ Kiot đang hoạt động dùng được; người khác thấy khung khoá kèm nút mở Kiot.
export default async function AiStudioPage() {
  const [user, t, status] = await Promise.all([getCurrentUser(), getT(), aiStatus()]);
  const owner = user ? await isStudioOwner(user.id) : false;
  const quota = owner && user ? await aiQuota(user.id) : null;

  const header = (
    <>
      <p className="flex items-center gap-2 text-[12px] font-black">
        <Sparkles className="h-4 w-4 text-brand" aria-hidden /> {t('ai.badge')}
      </p>
      <h1 className="mt-2 font-display text-[22px] font-black leading-tight md:text-[28px]">
        {t('common.slogan.ai')}
      </h1>
      <p className="mt-2 text-[13px] text-white/75">{t('ai.lead')}</p>
    </>
  );

  return (
    <div className="mx-auto max-w-[900px] px-3 py-5 md:px-6">
      {owner && quota && status.enabled ? (
        <ClientMessages prefixes={['ai.', 'market.cat.']}>
          <AiStudio
            header={header}
            text={status.text}
            image={status.image}
            budgetOk={status.budgetLeftVnd > 0}
            quota={quota}
            categories={CATEGORIES.map((c) => c.slug)}
            styles={AI_STYLES.map(({ id, name }) => ({ id, name }))}
          />
        </ClientMessages>
      ) : (
        <div
          className="rounded-[24px] border border-white/10 bg-gradient-to-br from-fuchsia-700/40 via-brand/30 to-cyan-600/30 p-5"
          data-testid="ai-locked"
        >
          {header}
          <p className="mt-3 flex items-center gap-1 text-[13px] text-white/80">
            <Lock className="h-4 w-4" aria-hidden /> {owner ? t('ai.off') : t('ai.locked')}
          </p>
          {owner ? null : (
            <Link
              href={user ? '/kiot-cua-toi' : '/dang-nhap?next=/ai'}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-black shadow-[0_0_20px_rgb(255_107_0/0.5)]"
            >
              <Lock className="h-5 w-5" aria-hidden /> {user ? t('ai.openKiot') : t('ai.login')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
