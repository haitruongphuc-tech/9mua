import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ContactButtons } from '@/components/kiot/ContactButtons';
import { PreviewBanner } from '@/components/kiot/PreviewBanner';
import { ProductGrid } from '@/components/kiot/ProductGrid';
import { getCurrentUser } from '@/modules/identity';
import { getPublicKiot, listPublicProducts } from '@/modules/kiot';
import { kiotBasePath, kiotCanonical } from '../kiot-context';

const load = cache(async (slug: string) => getPublicKiot(slug, (await getCurrentUser())?.id ?? null));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: 'Kiot tạm ngưng', robots: { index: false } };
  const { kiot, preview } = found;
  const description = kiot.description || `Mua hàng tại ${kiot.name} trên 9MUA.`;
  return {
    title: kiot.name,
    description,
    alternates: { canonical: kiotCanonical(slug) },
    robots: preview ? { index: false } : undefined,
    openGraph: {
      title: kiot.name,
      description,
      url: kiotCanonical(slug),
      images: kiot.coverUrl ?? kiot.logoUrl ?? '/og-default.png',
    },
  };
}

export default async function KiotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ trang?: string }>;
}) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { kiot, preview } = found;
  const cursor = (await searchParams).trang;
  const [products, base] = await Promise.all([
    listPublicProducts({ kiotId: kiot.id, limit: 60, cursor }),
    kiotBasePath(slug),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
      {preview ? <PreviewBanner /> : null}
      <header className="flex items-start gap-4">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-brand-ink bg-brand text-2xl font-extrabold text-brand-ink">
          {kiot.logoUrl ? (
            <Image src={kiot.logoUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
          ) : (
            <span aria-hidden data-testid="kiot-initial">
              {kiot.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-extrabold leading-tight">{kiot.name}</h1>
          {kiot.description ? <p className="text-black/70">{kiot.description}</p> : null}
          <ContactButtons phone={kiot.contactPhone} />
        </div>
      </header>
      {products.items.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Kiot chưa có sản phẩm.</p>
      ) : (
        <ProductGrid items={products.items} basePath={base} />
      )}
      {products.nextCursor ? (
        <a
          href={`${base || '/'}?trang=${products.nextCursor}`}
          className="self-center rounded-full border-2 border-brand-ink px-6 py-2 font-bold"
        >
          Xem thêm
        </a>
      ) : null}
    </div>
  );
}
