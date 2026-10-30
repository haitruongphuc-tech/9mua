import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { commitmentLines } from '@/components/commitment/CommitmentLines';
import { getT } from '@/i18n/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { currentCommitment, hasCurrentCommitment, requireUser } from '@/modules/identity';
import { acceptCommitmentAction } from './actions';

export const metadata: Metadata = { robots: { index: false } };

// Bảng M5: tick đủ 4 ô rồi bấm "Tôi cam kết" (SPEC-identity.md V5.6). Đã đồng ý bản mới nhất thì đi thẳng tới next.
export default async function AcceptCommitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; thieu?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const next = safeNextPath(params.next ?? '/');
  if (await hasCurrentCommitment(user.id)) redirect(next);
  const [t, current] = await Promise.all([getT(), currentCommitment()]);
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('common.commit.title')}</h1>
      <p className="text-[14px] text-white/80">
        {current.version > 1 ? t('common.commit.updated') : t('common.commit.intro')}
      </p>
      <form
        action={acceptCommitmentAction.bind(null, current.version, next)}
        className="flex flex-col gap-3"
        data-testid="commitment-form"
      >
        {commitmentLines(t, current.lines).map((line, i) => (
          <label
            key={i}
            className="flex gap-3 rounded-[14px] border border-white/10 bg-white/5 p-3 text-[14px]"
          >
            <input
              type="checkbox"
              name="line"
              value={i}
              required
              className="mt-1 h-5 w-5 shrink-0 accent-[#ff6b00]"
            />
            <span>{line}</span>
          </label>
        ))}
        {params.thieu ? (
          <p role="alert" className="text-[13px] font-bold text-red-300">
            {t('common.commit.tickAll')}
          </p>
        ) : null}
        <button
          type="submit"
          className="h-12 rounded-full bg-brand font-black text-white"
          data-testid="commitment-accept"
        >
          {t('common.commit.agree')}
        </button>
      </form>
    </section>
  );
}
