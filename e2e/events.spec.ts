import { expect, test } from '@playwright/test';
import { newBuyerPage } from './helpers/auth';

// Giờ Việt Nam dạng datetime-local, cách bây giờ `hours` giờ.
function vnLocal(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000 + 7 * 3_600_000).toISOString().slice(0, 16);
}

// Sự kiện (SPEC-social.md V5.7): tạo sự kiện tại địa điểm, hiện trong /su-kien, người khác bấm Quan tâm.
test('tạo sự kiện, hiện trong danh sách, người khác quan tâm', async ({ browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Chủ sự kiện ${stamp}`);
  await owner.goto('/su-kien/tao');
  const form = owner.getByTestId('event-form');
  await form.locator('[name=title]').fill(`Hội chợ ${stamp}`);
  await form.locator('[name=startsAt]').fill(vnLocal(48));
  await form.locator('[name=endsAt]').fill(vnLocal(50));
  await form.locator('[name=province]').selectOption({ index: 1 });
  await form.locator('[name=address]').fill('12 Lê Lợi');
  await owner.getByTestId('event-submit').click();
  await expect(owner.getByTestId('event-title')).toHaveText(`Hội chợ ${stamp}`);
  const url = owner.url();

  const fan = await newBuyerPage(browser, `Khách sự kiện ${stamp}`);
  await fan.goto('/su-kien');
  await expect(fan.getByTestId('event-list').getByText(`Hội chợ ${stamp}`)).toBeVisible();
  await fan.goto(url);
  await fan.getByTestId('event-interest').click();
  await expect(fan.getByTestId('event-interest-count')).toContainText('1');
});
