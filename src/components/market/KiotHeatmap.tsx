'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { KiotResultCard } from '@/components/market/KiotResultCard';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { KiotSearchCard } from '@/modules/marketplace';

type Cell = { lat: number; lng: number; count: number };

// Bản đồ nhiệt Kiot (SPEC-marketplace.md V5.3): vòng tròn theo ô ~1,1 km, càng nhiều Kiot càng đậm; bấm ô xem danh sách;
// chấm xanh vị trí người xem khi đã cho phép. leaflet tải động để không vào bundle trang khác.
export function KiotHeatmap({ tileUrl, attribution }: { tileUrl: string; attribution: string }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [cells, setCells] = useState(0);
  const [picked, setPicked] = useState<KiotSearchCard[] | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let layer: LayerGroup | null = null;
    let cancelled = false;
    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !box.current || map.current) return;
      const m = L.map(box.current).setView([16.0, 106.5], 6);
      map.current = m;
      L.tileLayer(tileUrl, { attribution, maxZoom: 18 }).addTo(m);
      layer = L.layerGroup().addTo(m);
      async function load() {
        const b = m.getBounds();
        const q = new URLSearchParams({
          south: String(b.getSouth()),
          west: String(b.getWest()),
          north: String(b.getNorth()),
          east: String(b.getEast()),
        });
        const res = await fetch(`/api/cho/ban-do?${q}`);
        const data = (await res.json().catch(() => null)) as { cells?: Cell[] } | null;
        layer?.clearLayers();
        const list = data?.cells ?? [];
        setCells(list.length);
        for (const c of list)
          L.circle([c.lat, c.lng], {
            radius: 550,
            stroke: false,
            fillColor: '#ff6b00',
            fillOpacity: Math.min(0.9, 0.25 + c.count * 0.12),
            className: 'heat-cell',
          })
            .on('click', async () => {
              const r = await fetch(`/api/cho/ban-do/o?lat=${c.lat}&lng=${c.lng}`);
              const d = (await r.json().catch(() => null)) as { kiots?: KiotSearchCard[] } | null;
              setPicked(d?.kiots ?? []);
            })
            .addTo(layer!);
      }
      m.on('moveend', () => void load());
      await load();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [tileUrl, attribution]);

  async function locate() {
    const L = (await import('leaflet')).default;
    if (!navigator.geolocation) return setDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (!map.current) return;
        L.circleMarker(here, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(map.current);
        map.current.setView(here, 13);
      },
      () => setDenied(true),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
        <button
          type="button"
          onClick={() => void locate()}
          className="h-9 rounded-full bg-white/10 px-4 font-bold"
        >
          📍 {t('market.map.locate')}
        </button>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded-full bg-brand align-middle" />{' '}
          {t('market.map.legend')}
        </span>
        <span data-testid="heatmap-cells" data-count={cells}>
          {t('market.map.cells', { count: cells })}
        </span>
      </div>
      {denied ? (
        <p role="alert" className="text-[12px] font-bold text-red-300">
          {t('market.near.denied')}
        </p>
      ) : null}
      <div
        ref={box}
        className="h-[60vh] min-h-[320px] w-full overflow-hidden rounded-[16px]"
        data-testid="heatmap"
      />
      {picked ? (
        picked.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="heatmap-kiots">
            {picked.map((k) => (
              <li key={k.slug}>
                <KiotResultCard
                  kiot={k}
                  labels={{
                    products: t('market.kiotSearch.products', { count: k.products }),
                    price:
                      k.priceMin !== null && k.priceMax !== null
                        ? `${formatVnd(k.priceMin)} – ${formatVnd(k.priceMax)}`
                        : null,
                    distance: null,
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-white/60">{t('market.dir.empty')}</p>
        )
      ) : null}
    </div>
  );
}
