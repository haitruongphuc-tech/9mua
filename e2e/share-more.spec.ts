import { expect, test, type Page } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

const processQueue = (page: Page) =>
  page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });

async function postVideo(page: Page, caption: string) {
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await page.getByTestId('video-caption').fill(caption);
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi');
  await processQueue(page);
  return e2eDb.video.findFirstOrThrow({ where: { caption } });
}

// Chia sẻ thêm (SPEC-creator.md V5.7, SPEC-messages.md V5.1): gửi qua Hộp thư, tải về có logo, mã nhúng, TikTok.
test('bảng chia sẻ: gửi video qua Hộp thư, tải về có logo, nhúng, TikTok', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Chủ clip ${stamp}`);
  const video = await postVideo(owner, `Chia sẻ ${stamp}`);
  const fan = await newBuyerPage(browser, `Fan ${stamp}`);
  const fanUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Fan ${stamp}` } });
  // Hai người đã nhắn với nhau trước đó.
  const [a, b] = [fanUser.id, video.authorId].sort();
  const at = new Date();
  const conv = await e2eDb.conversation.create({
    data: { userAId: a!, userBId: b!, status: 'active', lastMessageAt: at, createdAt: at, acceptedAt: at },
  });
  await e2eDb.conversationMember.createMany({
    data: [
      { conversationId: conv.id, userId: a! },
      { conversationId: conv.id, userId: b! },
    ],
  });
  await e2eDb.message.create({
    data: { conversationId: conv.id, senderId: video.authorId, text: 'Chào bạn', createdAt: at },
  });

  await fan.goto(`/v/${video.id}`);
  await fan.getByTestId('feed-item').first().getByTestId('feed-share').click();
  const sheet = fan.getByTestId('share-sheet');
  await expect(sheet.getByTestId('share-recent')).toContainText(`Chủ clip ${stamp}`);
  await sheet.getByTestId('share-note').fill('Xem video này nè');
  await sheet.getByTestId('share-send').first().click();
  await expect(fan.getByTestId('feed-toast')).toContainText(`Đã gửi cho Chủ clip ${stamp}`);
  // Mã nhúng trỏ tới /nhung/<id>.
  await expect(sheet.getByTestId('share-embed-code')).toHaveValue(new RegExp(`/nhung/${video.id}"`));
  // TikTok: chép link rồi mở app (điện thoại) hoặc trang web của TikTok (máy tính). Trình duyệt giả lập không có app
  // TikTok nên chỉ bấm thử trên máy tính.
  await expect(sheet.getByTestId('share-instagram')).toBeVisible();
  if (test.info().project.name === 'desktop-chromium') {
    const popup = fan.context().waitForEvent('page');
    await sheet.getByTestId('share-tiktok').click();
    await expect(fan.getByTestId('feed-toast')).toContainText('Đã chép link, dán vào TikTok');
    await (await popup).close();
  }

  // Tải về: lần đầu máy chủ tạo bản có logo, trình duyệt tự hỏi lại rồi tải file.
  await fan.goto(`/v/${video.id}`);
  await fan.getByTestId('feed-item').first().getByTestId('feed-share').click();
  const download = fan.waitForEvent('download', { timeout: 60_000 });
  await fan.getByTestId('share-sheet').getByTestId('share-download').click();
  await expect(fan.getByTestId('feed-toast')).toContainText('Đang tạo bản tải về có logo');
  await processQueue(fan);
  expect((await download).suggestedFilename()).toBe(`9mua-${video.id}.mp4`);

  // Người nhận thấy thẻ video trong Hộp thư.
  await owner.goto(`/hop-thu/${conv.id}`);
  await expect(owner.getByTestId('chat-video')).toContainText(`@Chủ clip ${stamp}`);
  await expect(owner.getByTestId('chat-message').last()).toContainText('Xem video này nè');

  // Trang nhúng: web khác nhúng được; video không công khai thì 404.
  const embed = await fan.evaluate(async (id) => {
    const r = await fetch(`/nhung/${id}`, { cache: 'no-store' });
    return {
      status: r.status,
      frame: r.headers.get('x-frame-options'),
      csp: r.headers.get('content-security-policy'),
    };
  }, video.id);
  expect(embed.status).toBe(200);
  expect(embed.frame).toBeNull();
  expect(embed.csp).toContain('frame-ancestors *');
  await fan.goto(`/nhung/${video.id}`);
  await expect(fan.getByTestId('embed-open')).toHaveText('Xem trên 9MUA');
  await e2eDb.video.update({ where: { id: video.id }, data: { visibility: 'private' } });
  expect(await fan.evaluate(async (id) => (await fetch(`/nhung/${id}`)).status, video.id)).toBe(404);
  // Trang thường vẫn chặn nhúng.
  expect(await fan.evaluate(async () => (await fetch('/')).headers.get('x-frame-options'))).toBe('DENY');
});
