import { expect, test } from '@playwright/test';
import { newBuyerPage } from './helpers/auth';
import { e2eDb } from './helpers/db';

// Tìm kiếm từ header (SPEC-social.md bổ sung 30/10, A3): tài khoản, video, hashtag, sản phẩm; tìm không dấu.
test('tìm tài khoản, video, hashtag từ header; tìm không dấu', async ({ browser, isMobile }) => {
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Thành Long ${stamp}`);
  const user = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Thành Long ${stamp}` } });
  await e2eDb.video.create({
    data: {
      authorId: user.id,
      caption: `Thanh long ruột đỏ ${stamp} #tk${stamp}`,
      hashtags: [`tk${stamp}`],
      status: 'ready',
      kind: 'video',
      fileUrl: '/uploads/khong-co.mp4',
      posterUrl: null,
      readyAt: new Date(),
    },
  });

  await page.goto('/cho/kiot');
  const header = page.getByRole('banner');
  if (isMobile) {
    await header.getByRole('link', { name: 'Tìm kiếm' }).tap();
    await page.waitForURL((u) => u.pathname === '/tim-kiem');
    const box = page.getByRole('main').getByRole('searchbox', { name: 'Tìm trên 9MUA' });
    await box.fill(`thanh long ${stamp}`);
    await box.press('Enter');
  } else {
    const box = header.getByRole('searchbox', { name: 'Tìm trên 9MUA' });
    await box.fill(`thanh long ${stamp}`);
    await box.press('Enter');
  }
  await page.waitForURL(
    (u) => u.pathname === '/tim-kiem' && u.searchParams.get('q') === `thanh long ${stamp}`,
  );

  // Tab Tất cả: tài khoản (gõ không dấu vẫn ra "Thành Long") và video.
  await expect(page.getByTestId('search-user').first()).toContainText(`Thành Long ${stamp}`);
  await expect(page.getByTestId('search-videos').getByRole('link')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Xem tất cả trong Chợ' })).toHaveAttribute(
    'href',
    `/cho?q=thanh%20long%20${stamp}`,
  );

  // Tab Hashtag: gõ "#TK…" vẫn ra hashtag kèm số video, bấm vào là trang hashtag.
  await page.goto(`/tim-kiem?q=%23TK${stamp}&tab=hashtag`);
  await expect(page.getByTestId('search-hashtag')).toHaveText(`#tk${stamp}1 video`);
  await page.getByTestId('search-hashtag').click();
  await page.waitForURL((u) => u.pathname === `/hashtag/tk${stamp}`);

  // Tab Tài khoản: bấm vào là trang cá nhân. Không có kết quả thì báo rõ.
  await page.goto(`/tim-kiem?q=thanh%20long%20${stamp}&tab=tai-khoan`);
  await page.getByTestId('search-user').first().click();
  // Có @tên thì link cũ /creator/<id> chuyển sang /@<tên> (SPEC-identity.md V5.1).
  await page.waitForURL((u) => u.pathname.startsWith('/@'));
  await page.goto(`/tim-kiem?q=khongcogi${stamp}`);
  await expect(page.getByTestId('search-empty')).toHaveText(
    `Không tìm thấy kết quả cho “khongcogi${stamp}”.`,
  );
});
