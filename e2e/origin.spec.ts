import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

// Hồ sơ nguồn gốc (SPEC-kiot.md V5.2): chủ Kiot nộp hoá đơn + 3 ảnh hàng + 2 cam kết → trạng thái "Đang chờ duyệt".
test('chủ Kiot nộp hồ sơ nguồn gốc', async ({ page }) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Nguồn Gốc');
  await activateKiot(slug);
  await page.goto('/kiot-cua-toi/nguon-goc');
  await expect(page.getByTestId('origin-status')).toHaveAttribute('data-status', 'none');
  const form = page.getByTestId('origin-form');
  const img = 'e2e/fixtures/anh-cam.jpg';
  await form.locator('[name=invoice]').setInputFiles(img);
  await form.locator('[name=photos]').setInputFiles([img, img, img]);
  await form.locator('[name=commitOrigin]').check();
  await form.locator('[name=commitRefund]').check();
  await page.getByTestId('origin-submit').click();
  await page.waitForURL(/da-gui=1/);
  await expect(page.getByTestId('origin-status')).toHaveAttribute('data-status', 'pending');
});
