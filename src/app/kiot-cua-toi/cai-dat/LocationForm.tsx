'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { setLocationAction } from './location-actions';

// Vị trí cửa hàng (SPEC-kiot.md V5.1): "Dùng vị trí hiện tại" đặt ghim; chưa đặt thì tính theo tâm tỉnh.
export function LocationForm({ pinned, showExact }: { pinned: boolean; showExact: boolean }) {
  const t = useT();
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  function locate() {
    setError('');
    if (!navigator.geolocation) return setError(t('seller.loc.denied'));
    navigator.geolocation.getCurrentPosition(
      (p) => setPin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError(t('seller.loc.denied')),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }
  return (
    <form action={setLocationAction} className="flex flex-col gap-3" data-testid="kiot-location-form">
      <p className="text-[13px] text-white/70" data-testid="kiot-location-status">
        {pin ? t('seller.loc.ready') : pinned ? t('seller.loc.pinned') : t('seller.loc.province')}
      </p>
      {pin ? (
        <>
          <input type="hidden" name="lat" value={pin.lat} />
          <input type="hidden" name="lng" value={pin.lng} />
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={locate}
          className="h-10 rounded-full bg-white/10 px-4 text-[13px] font-black"
          data-testid="kiot-location-use"
        >
          📍 {t('seller.loc.useCurrent')}
        </button>
        {pinned ? (
          <button
            type="submit"
            name="clear"
            value="1"
            className="h-10 rounded-full bg-white/5 px-4 text-[13px] font-bold"
          >
            {t('seller.loc.clear')}
          </button>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          name="showExact"
          defaultChecked={showExact}
          className="h-4 w-4 accent-[#ff6b00]"
        />
        {t('seller.loc.showExact')}
      </label>
      <p className="text-[11px] text-white/50">{t('seller.loc.privacy')}</p>
      {error ? (
        <p role="alert" className="text-[12px] font-bold text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="h-11 rounded-full bg-brand text-[14px] font-black"
        data-testid="kiot-location-save"
      >
        {t('seller.loc.save')}
      </button>
    </form>
  );
}
