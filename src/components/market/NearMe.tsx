'use client';

import { useState } from 'react';
import { MarketProductCard } from '@/components/market/MarketProductCard';
import { KiotResultCard } from '@/components/market/KiotResultCard';
import { useLang, useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { KiotSearchCard, MarketCard } from '@/modules/marketplace';

const RADII = [1, 3, 5, 10, 20, 50];

// Chip "Gần tôi" (SPEC-marketplace.md V5.2): xin quyền vị trí trình duyệt; từ chối thì báo và giữ kết quả thường.
export function NearMe({ tab, q }: { tab: 'kiot' | 'san-pham'; q: string }) {
  const t = useT();
  const lang = useLang();
  const [radius, setRadius] = useState(10);
  const [state, setState] = useState<'idle' | 'busy' | 'denied' | 'done'>('idle');
  const [kiots, setKiots] = useState<KiotSearchCard[]>([]);
  const [products, setProducts] = useState<MarketCard[]>([]);

  function run(r = radius) {
    if (!navigator.geolocation) return setState('denied');
    setState('busy');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch('/api/tim-kiem/gan', {
          method: 'POST',
          body: JSON.stringify({ tab, q, lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: r }),
        });
        const data = (await res.json().catch(() => null)) as {
          kiots?: KiotSearchCard[];
          products?: MarketCard[];
        } | null;
        setKiots(data?.kiots ?? []);
        setProducts(data?.products ?? []);
        setState('done');
      },
      () => setState('denied'),
      { timeout: 15_000 },
    );
  }

  const km = (k: KiotSearchCard) =>
    k.distanceKm === null
      ? null
      : t(k.approx ? 'market.near.approxKm' : 'market.near.km', { km: k.distanceKm.toLocaleString(lang) });

  return (
    <div className="flex flex-col gap-3" data-testid="near-me">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run()}
          aria-pressed={state === 'done'}
          className={`h-9 rounded-full px-4 text-[13px] font-bold ${state === 'done' ? 'bg-brand' : 'bg-white/10'}`}
          data-testid="near-me-chip"
        >
          📍 {t('market.near.chip')}
        </button>
        {state === 'done' ? (
          <select
            value={radius}
            onChange={(e) => {
              const r = Number(e.target.value);
              setRadius(r);
              run(r);
            }}
            aria-label={t('market.near.radius')}
            className="h-9 rounded-full border border-white/15 bg-white/10 px-3 text-[13px]"
            data-testid="near-me-radius"
          >
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {state === 'busy' ? <p className="text-[12px] text-white/60">{t('market.near.locating')}</p> : null}
      {state === 'denied' ? (
        <p role="alert" className="text-[12px] font-bold text-red-300" data-testid="near-me-denied">
          {t('market.near.denied')}
        </p>
      ) : null}
      {state === 'done' && !kiots.length && !products.length ? (
        <p className="text-[13px] text-white/60" data-testid="near-me-empty">
          {t('market.near.empty', { km: radius })}
        </p>
      ) : null}
      {kiots.length ? (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="near-me-kiots">
          {kiots.map((k) => (
            <li key={k.slug}>
              <KiotResultCard
                kiot={k}
                labels={{
                  products: t('market.kiotSearch.products', { count: k.products }),
                  price:
                    k.priceMin !== null && k.priceMax !== null
                      ? `${formatVnd(k.priceMin)} – ${formatVnd(k.priceMax)}`
                      : null,
                  distance: km(k),
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {products.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="near-me-products">
          {products.map((p) => (
            <MarketProductCard key={p.id} p={p} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
