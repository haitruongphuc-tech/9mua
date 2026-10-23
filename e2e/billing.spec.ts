import { expect, test } from '@playwright/test';
import { signUpWithKiot } from './helpers/seller';

test('kích hoạt Kiot: bấm nút → trang QR → (PayOS giả) trả tiền → trang tự chuyển "Kiot đã hoạt động" → Kiot công khai', async ({
  page,
  browser,
}) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Kích Hoạt');
  await page.getByTestId('activate-kiot').click();
  await page.waitForURL(/\/kiot-cua-toi\/thanh-toan\/[^/]+$/);
  const qrPage = page.url();
  await expect(page.getByTestId('payment-amount')).toHaveText('26.000đ');
  await expect(page.getByTestId('payment-qr').locator('svg')).toBeVisible();
  await expect(page.getByTestId('payment-countdown')).toContainText('Mã còn hiệu lực');

  // Bấm 2 lần không sinh 2 mã.
  await page.goto('/kiot-cua-toi');
  await page.getByTestId('activate-kiot').click();
  await page.waitForURL(/\/kiot-cua-toi\/thanh-toan\/[^/]+$/);
  expect(page.url()).toBe(qrPage);

  // Mở trang PayOS giả trong tab khác và "trả tiền"; trang QR tự chuyển sang thành công.
  const href = await page.getByRole('link', { name: /Mở trang thanh toán/ }).getAttribute('href');
  const payos = await page.context().newPage();
  await payos.goto(href!);
  await payos.getByRole('button', { name: 'Giả lập đã trả đủ' }).click();
  await expect(payos.getByTestId('fake-status')).toHaveText('paid');
  await payos.close();

  await expect(page.getByTestId('payment-success')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('active-until')).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}/);

  const guest = await browser.newPage();
  const res = await guest.goto(`http://${slug}.9mua.test:${new URL(page.url()).port}`);
  expect(res?.status()).toBe(200);
  await guest.close();

  await page.goto('/kiot-cua-toi/thanh-toan');
  await expect(page.getByTestId('billing-history')).toContainText('26.000đ');
});

test('mất webhook: trang QR vẫn tự phát hiện đã trả nhờ hỏi lại PayOS', async ({ page }) => {
  await signUpWithKiot(page, 'Kiot Mất Webhook');
  await page.getByTestId('activate-kiot').click();
  await page.waitForURL(/\/kiot-cua-toi\/thanh-toan\/[^/]+$/);
  const href = await page.getByRole('link', { name: /Mở trang thanh toán/ }).getAttribute('href');
  const payos = await page.context().newPage();
  await payos.goto(href!);
  await payos.getByRole('button', { name: 'Giả lập trả nhưng mất webhook' }).click();
  await payos.waitForLoadState('load');
  await payos.close();
  await expect(page.getByTestId('payment-success')).toBeVisible({ timeout: 20_000 });
});
