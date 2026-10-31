import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KiotHeatmap } from '@/components/market/KiotHeatmap';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bản đồ Kiot', alternates: { canonical: '/cho/ban-do' } };

// Bản đồ nhiệt Kiot (SPEC-marketplace.md V5.3), công tắc map. Ảnh nền từ MAP_TILE_URL (máy dev/E2E dùng OpenStreetMap).
export default async function KiotMapPage() {
  if (!(await isFeatureOn('map'))) notFound();
  const t = await getT();
  const e = env();
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
      <h1 className="font-display text-[22px] font-black">🗺 {t('market.map.title')}</h1>
      <ClientMessages prefixes={['market.']}>
        <KiotHeatmap
          tileUrl={e.MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
          attribution={e.MAP_ATTRIBUTION ?? '© OpenStreetMap'}
        />
      </ClientMessages>
    </section>
  );
}
