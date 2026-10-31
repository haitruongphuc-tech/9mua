import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

const SWITCH = 'feature.page_import';
const setSwitch = (value: 'on' | 'off') =>
  e2eDb.setting.upsert({ where: { key: SWITCH }, create: { key: SWITCH, value }, update: { value } });

// Nhập Page (SPEC-kiot.md V5.4), driver giả ở E2E: tìm → tick → nhập → ngắt kết nối.
test('nhập Page từ mạng xã hội rồi ngắt kết nối', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'công tắc chung, chạy một lần');
  await setSwitch('on');
  try {
    const page = await newBuyerPage(browser, `Nhập Page ${String(Date.now()).slice(-5)}`);
    await page.goto('/ket-noi');
    await page.getByTestId('page-import-q').fill('@cuahangthu');
    await page.getByTestId('page-import-find').click();
    await page.getByTestId('page-import-results').getByRole('checkbox').nth(1).check();
    await page.getByTestId('page-import-submit').click();
    await expect(page.getByTestId('page-import-list')).toContainText('cuahangthu');
    await page.getByTestId('page-import-disconnect').click();
    await expect(page.getByTestId('page-import-list')).toHaveCount(0);
  } finally {
    await setSwitch('off');
  }
});
