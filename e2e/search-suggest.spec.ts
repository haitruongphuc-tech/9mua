import { expect, test } from '@playwright/test';
import { newBuyerPage } from './helpers/auth';

// Lịch sử tìm (SPEC-marketplace.md V5.4): tìm xong, bấm vào ô trống thấy từ vừa tìm; "Xoá hết" thì mất.
test('lịch sử tìm hiện khi bấm vào ô tìm, xoá hết được', async ({ browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Tìm ${stamp}`);
  await page.goto(`/tim-kiem?q=${encodeURIComponent(`dua luoi ${stamp}`)}`);
  await page.goto('/tim-kiem');
  await page.getByTestId('search-input').click();
  await expect(page.getByTestId('search-history')).toContainText(`dua luoi ${stamp}`);
  await page.getByTestId('search-history-clear').click();
  await expect(page.getByTestId('search-history')).toHaveCount(0);
});
