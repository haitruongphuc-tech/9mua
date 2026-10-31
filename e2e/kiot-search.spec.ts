import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

// Máy E2E chạy http://9mua.test (không phải HTTPS) nên trình duyệt từ chối Geolocation thật: thay bằng vị trí cố định.
function fakeGeo(lat: number, lng: number) {
  return `Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (ok) =>
    ok({ coords: { latitude: ${lat}, longitude: ${lng}, accuracy: 10 } }) } });`;
}

// Tìm Kiot theo tên + Gần tôi (SPEC-marketplace.md V5.1–V5.2); chủ Kiot đặt ghim "Dùng vị trí hiện tại" (SPEC-kiot.md V5.1).
test('chủ Kiot đặt ghim; người mua tìm Kiot theo tên và Gần tôi', async ({ browser }) => {
  test.setTimeout(90_000);
  const here = { latitude: 10.7725, longitude: 106.698 };
  const sellerCtx = await browser.newContext();
  await sellerCtx.addInitScript(fakeGeo(here.latitude, here.longitude));
  const seller = await sellerCtx.newPage();
  const { slug } = await signUpWithKiot(seller, 'Ốc Gần Đây');
  await activateKiot(slug);
  const kiot = await e2eDb.kiot.update({ where: { slug }, data: { province: 'tp-ho-chi-minh' } });
  await e2eDb.product.create({
    data: {
      kiotId: kiot.id,
      name: 'Ốc hương rang muối',
      price: 120_000,
      stock: 5,
      category: 'thuc-pham-dac-san',
      images: {
        create: {
          kiotId: kiot.id,
          url: '/uploads/p.webp',
          thumbUrl: '/uploads/p-400.webp',
          width: 1,
          height: 1,
        },
      },
    },
  });
  await seller.goto('/kiot-cua-toi/cai-dat#vi-tri');
  await seller.getByTestId('kiot-location-use').click();
  await expect(seller.getByTestId('kiot-location-status')).toContainText(/Đã lấy vị trí/);
  await seller.getByTestId('kiot-location-save').click();
  await seller.waitForURL(/da-luu=vi-tri/);
  expect((await e2eDb.kiot.findUniqueOrThrow({ where: { slug } })).geoSource).toBe('pin');

  const buyerCtx = await browser.newContext();
  await buyerCtx.addInitScript(fakeGeo(10.776, 106.701));
  const buyer = await buyerCtx.newPage();
  const name = kiot.name.toLowerCase().replace('ốc gần đây', 'oc gan day');
  await buyer.goto(`/tim-kiem?q=${encodeURIComponent(name)}&tab=kiot`);
  await expect(buyer.getByTestId('search-kiots').getByTestId('search-kiot').first()).toContainText(kiot.name);
  await buyer.getByTestId('near-me-chip').click();
  await expect(buyer.getByTestId('near-me-kiots')).toContainText(kiot.name);
  await expect(buyer.getByTestId('near-me-kiots').getByTestId('search-kiot-distance').first()).toContainText(
    'km',
  );
  await sellerCtx.close();
  await buyerCtx.close();
});
