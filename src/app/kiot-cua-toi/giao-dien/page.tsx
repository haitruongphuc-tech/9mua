import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import {
  DEFAULT_LAYOUT,
  getKiotByOwner,
  KIOT_PALETTES,
  KIOT_TEMPLATES,
  kiotLayoutOf,
  listProductsForOwner,
  MAX_FEATURED,
} from '@/modules/kiot';
import { KiotBuilder } from './KiotBuilder';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Giao diện Kiot', robots: { index: false } };

// Giao diện Kiot (SPEC-kiot.md V5.3), công tắc kiot_builder.
export default async function KiotDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-luu'?: string; loi?: string }>;
}) {
  if (!(await isFeatureOn('kiot_builder'))) notFound();
  const user = await requireUser();
  const [t, query, kiot] = await Promise.all([getT(), searchParams, getKiotByOwner(user.id)]);
  if (!kiot) notFound();
  const products = await listProductsForOwner(user.id);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-[20px] font-black">{t('seller.builder.title')}</h1>
      <p className="text-[13px] text-white/70">{t('seller.builder.lead')}</p>
      {query['da-luu'] ? (
        <p role="status" className="text-[13px] font-bold text-green-300" data-testid="builder-saved">
          {t('seller.builder.saved')}
        </p>
      ) : null}
      {query.loi ? (
        <p role="alert" className="text-[13px] font-bold text-red-300">
          {t('seller.builder.error')}
        </p>
      ) : null}
      <ClientMessages prefixes={['seller.builder.']}>
        <KiotBuilder
          initial={kiotLayoutOf(kiot) ?? DEFAULT_LAYOUT}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          templates={KIOT_TEMPLATES}
          palettes={KIOT_PALETTES}
          maxFeatured={MAX_FEATURED}
        />
      </ClientMessages>
    </section>
  );
}
