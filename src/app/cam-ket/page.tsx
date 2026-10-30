import type { Metadata } from 'next';
import { commitmentLines } from '@/components/commitment/CommitmentLines';
import { getT } from '@/i18n/server';
import { currentCommitment } from '@/modules/identity';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('common.commit.title') };
}

// Trang công khai /cam-ket: bản cam kết nội dung mới nhất (SPEC-identity.md V5.6).
export default async function CommitmentPage() {
  const [t, current] = await Promise.all([getT(), currentCommitment()]);
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('common.commit.title')}</h1>
      <p className="text-[13px] text-white/60">{t('common.commit.version', { version: current.version })}</p>
      <p className="text-[14px] text-white/80">{t('common.commit.intro')}</p>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-[15px]" data-testid="commitment-lines">
        {commitmentLines(t, current.lines).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
