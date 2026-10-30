import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { captionsForEdit } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { saveCaptionsAction } from './actions';

export const metadata: Metadata = { title: 'Phụ đề', robots: { index: false } };

const REASONS = ['TOO_LONG', 'BUDGET', 'NO_AUDIO'] as const;

// Xem và sửa phụ đề tự động trước khi bật cho người xem (SPEC-creator.md V5.4 mục 2).
export default async function CaptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ luu?: string; loi?: string }>;
}) {
  const user = await requireUser();
  if (!(await isFeatureOn('auto_captions'))) notFound();
  const [c, q, t] = await Promise.all([captionsForEdit(user.id, (await params).id), searchParams, getT()]);
  if (!c) notFound();
  const reason = REASONS.find((r) => r === c.reason);
  const status =
    c.status === 'ready'
      ? t('post.captions.ready')
      : c.status === 'skipped' && reason
        ? t(`post.captions.skipped.${reason}`)
        : c.status === 'failed'
          ? t('post.captions.failed')
          : t('post.captions.pending');
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link href="/video/cua-toi" className="text-[13px] font-bold text-white/60">
        ← {t('post.mine.title')}
      </Link>
      <h1 className="font-display text-[22px] font-black">{t('post.captions.title')}</h1>
      <p className="text-[13px] text-white/70">{c.caption || t('post.mine.noCaption')}</p>
      <p className="rounded-[14px] bg-white/5 px-4 py-3 text-[13px] font-bold" data-testid="captions-status">
        {status}
      </p>
      {q.luu ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('post.captions.saved')}
        </p>
      ) : null}
      {q.loi ? (
        <p role="alert" className="rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300">
          {t('post.captions.invalid')}
        </p>
      ) : null}
      {c.status === 'ready' ? (
        <form action={saveCaptionsAction} className="flex flex-col gap-3" data-testid="captions-form">
          <input type="hidden" name="videoId" value={c.videoId} />
          <label className="flex flex-col gap-2 text-[13px] font-bold">
            {t('post.captions.text')}
            <textarea
              name="vtt"
              defaultValue={c.vtt ?? ''}
              rows={14}
              spellCheck={false}
              className="rounded-[14px] border border-white/15 bg-white/10 p-3 font-mono text-[13px] font-normal text-white outline-none focus:border-brand"
              data-testid="captions-text"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="published"
              defaultChecked={c.published}
              className="h-4 w-4 accent-[#ff6b00]"
              data-testid="captions-publish"
            />
            {t('post.captions.publish')}
          </label>
          <button
            type="submit"
            className="h-12 rounded-full bg-brand font-black text-white"
            data-testid="captions-save"
          >
            {t('post.captions.save')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
