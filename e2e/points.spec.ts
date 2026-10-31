import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Điểm thưởng (SPEC-social.md V5.6): trang Tôi hiện tổng điểm; đổi điểm ra xu tắt sẵn nên chưa có nút đổi.
test('trang Tôi: hiện tổng điểm thưởng, chưa có nút đổi xu', async ({ browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const me = await newBuyerPage(browser, `Điểm ${stamp}`);
  const user = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Điểm ${stamp}` } });
  await e2eDb.pointEntry.create({
    data: {
      userId: user.id,
      kind: 'like',
      points: 1500,
      refType: 'video',
      refId: `e2e-${stamp}`,
      vnDay: '2026-10-30',
    },
  });
  await me.goto('/tai-khoan');
  await expect(me.getByTestId('me-points-balance')).toContainText('1.500');
  await expect(me.getByTestId('me-points-exchange')).toHaveCount(0);
});
