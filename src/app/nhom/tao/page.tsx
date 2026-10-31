import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { MAX_GROUP_DESCRIPTION, MAX_GROUP_NAME } from '@/modules/social';
import { createGroupAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tạo nhóm', robots: { index: false } };

const ERRORS = ['INVALID', 'HAS_LINK', 'TOO_NEW', 'LIMIT'] as const;
const field = 'h-11 rounded-[12px] border border-white/15 bg-white/5 px-3 text-[14px]';

// Tạo nhóm (SPEC-social.md V5.10 mục 1): tên ≤ 60, mô tả ≤ 500, Công khai / Riêng tư.
export default async function CreateGroupPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  if (!(await isFeatureOn('groups'))) notFound();
  await requireUser();
  const [t, { loi }] = await Promise.all([getT(), searchParams]);
  const err = ERRORS.find((e) => e === loi);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-bold">{t('feed.group.create')}</h1>
      {err ? (
        <p role="alert" className="text-[13px] font-bold text-red-300">
          {t(`feed.group.err.${err}`)}
        </p>
      ) : null}
      <form action={createGroupAction} className="flex flex-col gap-3" data-testid="group-form">
        <input
          name="name"
          required
          maxLength={MAX_GROUP_NAME}
          placeholder={t('feed.group.nameHint')}
          className={field}
        />
        <textarea
          name="description"
          maxLength={MAX_GROUP_DESCRIPTION}
          rows={4}
          placeholder={t('feed.group.descriptionHint')}
          className="rounded-[12px] border border-white/15 bg-white/5 p-3 text-[14px]"
        />
        <fieldset className="flex flex-col gap-2 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="privacy" value="public" defaultChecked className="accent-[#ff6b00]" />
            {t('feed.group.public')} — {t('feed.group.publicHint')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="privacy"
              value="private"
              className="accent-[#ff6b00]"
              data-testid="group-private"
            />
            {t('feed.group.private')} — {t('feed.group.privateHint')}
          </label>
        </fieldset>
        <button
          type="submit"
          className="h-11 rounded-full bg-brand text-[14px] font-black"
          data-testid="group-submit"
        >
          {t('feed.group.create')}
        </button>
      </form>
    </div>
  );
}
