import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

test('Kiot: logo, ảnh bìa, địa chỉ lấy hàng; trang công khai chỉ hiện tỉnh và quận', async ({ page }) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Hồ Sơ');
  await activateKiot(slug);
  await page.goto('/kiot-cua-toi/cai-dat');
  await page.setInputFiles('[data-testid=logo-input]', 'e2e/fixtures/anh-cam.jpg');
  await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
  await page.setInputFiles('[data-testid=cover-input]', 'e2e/fixtures/anh-den.jpg');
  await expect(page.getByRole('img', { name: 'Ảnh bìa' })).toBeVisible();
  await page.setInputFiles('[data-testid=cover-input]', 'e2e/fixtures/khong-phai-anh.jpg');
  await expect(page.getByRole('alert')).toBeVisible();

  await page.selectOption('#kiot-province', 'lam-dong');
  await page.fill('#kiot-district', 'Đà Lạt');
  await page.fill('#kiot-address', 'Số 9 đường Hoa Hồng');
  await page.getByRole('button', { name: 'Lưu địa chỉ' }).click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu địa chỉ.');

  await page.reload();
  await expect(page.locator('#kiot-province')).toHaveValue('lam-dong');

  await page.goto(`http://${slug}.9mua.test:3100/`);
  await expect(page.getByTestId('kiot-location')).toHaveText('📍 Đà Lạt, Lâm Đồng');
  await expect(page.locator('body')).not.toContainText('Hoa Hồng');
  await expect(page.getByTestId('kiot-logo')).toBeVisible();
  await expect(page.getByTestId('kiot-cover')).toBeVisible();
});
