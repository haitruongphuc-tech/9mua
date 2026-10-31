import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

// Giao diện Kiot (SPEC-kiot.md V5.3): chọn bố cục / bảng màu, bật khối Liên hệ, đưa xuống dưới, lưu → trang Kiot đổi.
test('chủ Kiot chỉnh giao diện, trang Kiot áp dụng sau khi Lưu', async ({ page }) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Giao Diện');
  await activateKiot(slug);
  await page.goto(`/k/${slug}`);
  await expect(page.getByTestId('kiot-blocks')).toHaveCount(0);

  await page.goto('/kiot-cua-toi/giao-dien');
  await page.getByTestId('builder-templates').getByRole('button', { name: '7' }).click();
  await page.getByTestId('builder-palette-p3').click();
  await page.getByTestId('builder-down-contact').click();
  await page.getByTestId('builder-save').click();
  await page.waitForURL(/da-luu=1/);
  const kiot = await e2eDb.kiot.findUniqueOrThrow({ where: { slug } });
  expect(kiot.layout).toMatchObject({ template: 'l7', palette: 'p3' });

  await page.goto(`/k/${slug}`);
  await expect(page.getByTestId('kiot-blocks')).toHaveAttribute('data-palette', 'p3');
  await expect(page.getByTestId('kiot-block-contact')).toBeVisible();
});
