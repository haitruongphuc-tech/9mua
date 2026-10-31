import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';

const SWITCH = 'feature.map';
const setSwitch = (value: 'on' | 'off') =>
  e2eDb.setting.upsert({ where: { key: SWITCH }, create: { key: SWITCH, value }, update: { value } });

// Bản đồ nhiệt (SPEC-marketplace.md V5.3): tắt sẵn thì 404; bật thì vẽ các ô có Kiot.
test('bản đồ nhiệt Kiot theo công tắc', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'công tắc chung, chạy một lần');
  await setSwitch('off');
  expect((await page.goto('/cho/ban-do'))?.status()).toBe(404);
  await setSwitch('on');
  try {
    await page.goto('/cho/kiot');
    await page.getByTestId('kiot-map-link').click();
    await expect(page.getByTestId('heatmap')).toBeVisible();
    const cells = await page.evaluate(async () => {
      const res = await fetch('/api/cho/ban-do?south=8&west=102&north=24&east=110');
      return res.ok ? ((await res.json()) as { cells: unknown }).cells : null;
    });
    expect(Array.isArray(cells)).toBe(true);
  } finally {
    await setSwitch('off');
  }
});
