import { expect, test } from '@playwright/test';
import { promoteToAdmin, setUpAdminTotp } from './helpers/admin';
import { signUpByEmail, signUpWithPassword } from './helpers/auth';
import { activateKiot, e2eDb } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// SPEC-messages.md (E2E): khách hỏi Kiot từ trang sản phẩm (kèm thẻ sản phẩm) → chủ Kiot thấy tin, trả lời → khách
// thấy ngay; người lạ nhắn → vào "Tin nhắn chờ" → chấp nhận; báo cáo → CEO thấy cuộc trò chuyện bị báo cáo.
test('hỏi Kiot từ trang sản phẩm → chủ Kiot trả lời → khách thấy ngay (SSE)', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await signUpWithKiot(page, 'Kiot Hộp Thư');
  await activateKiot(slug);
  await createProductViaUi(page, { name: 'Cà phê hộp thư', price: '90000' });

  const buyer = await browser.newPage();
  await signUpByEmail(buyer, { name: 'Khách Hỏi' });
  await buyer.goto(`http://${slug}.9mua.test:3100`);
  await buyer.getByTestId('product-grid').getByRole('link').first().click();
  // Chờ hẳn trang sản phẩm: trang Kiot cũng có nút "Nhắn tin" (không kèm sản phẩm).
  await buyer.waitForURL(/\/p\//);
  await buyer.getByTestId('message-button').click();
  await buyer.waitForURL(/9mua\.test:3100\/hop-thu\/[^/?]+\?sp=/);
  await expect(buyer.getByTestId('chat-attach-product')).toContainText('Cà phê hộp thư');
  await buyer.getByTestId('chat-input').fill('Còn hàng không shop?');
  await buyer.getByTestId('chat-send').click();
  await expect(buyer.getByTestId('chat-message').last()).toContainText('Còn hàng không shop?');
  await expect(buyer.getByTestId('chat-product').last()).toContainText('Cà phê hộp thư');
  // Không cho gửi link.
  await buyer.getByTestId('chat-input').fill('rẻ hơn ở shopee.vn/abc');
  await buyer.waitForTimeout(1100);
  await buyer.getByTestId('chat-send').click();
  await expect(buyer.getByTestId('toast')).toContainText('Không gửi link trong tin nhắn.');

  await page.goto('/hop-thu');
  const item = page.getByTestId('inbox-item').first();
  await expect(item).toContainText('Còn hàng không shop?');
  await expect(item.getByTestId('inbox-unread')).toHaveText('1');
  await item.click();
  await expect(page.getByTestId('chat-product')).toContainText('Cà phê hộp thư');
  await page.getByTestId('chat-input').fill('Còn ạ, giao trong ngày');
  await page.getByTestId('chat-send').click();

  // Khách đang mở cuộc trò chuyện: tin trả lời hiện ngay, không cần tải lại trang.
  await expect(buyer.getByTestId('chat-message').last()).toContainText('Còn ạ, giao trong ngày', {
    timeout: 10_000,
  });
  // Chủ Kiot thấy "Đã xem" khi khách đã đọc.
  await expect(page.getByTestId('chat-seen')).toBeVisible({ timeout: 10_000 });
});

test('người lạ nhắn → Tin nhắn chờ → chấp nhận; báo cáo → CEO thấy ở /admin/tin-nhan', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const creator = await browser.newPage();
  const creatorEmail = await signUpByEmail(creator, { name: 'Creator Nhận Tin' });
  const creatorUser = await e2eDb.user.findUniqueOrThrow({ where: { email: creatorEmail } });

  const stranger = await browser.newPage();
  const strangerEmail = await signUpByEmail(stranger, { name: 'Người Lạ' });
  // Tài khoản dưới 1 ngày chỉ nhắn được cho Kiot: cho tài khoản này "cũ" 2 ngày.
  await e2eDb.user.update({
    where: { email: strangerEmail },
    data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
  });
  await stranger.goto(`/creator/${creatorUser.id}`);
  await stranger.getByTestId('message-button').click();
  await stranger.waitForURL(/\/hop-thu\/[^/?]+$/);
  await stranger.getByTestId('chat-input').fill('Chào bạn, mình hỏi chút');
  await stranger.getByTestId('chat-send').click();
  await expect(stranger.getByTestId('chat-message').last()).toContainText('Chào bạn, mình hỏi chút');

  await creator.goto('/hop-thu');
  await expect(creator.getByTestId('inbox-empty')).toBeVisible();
  await creator.getByTestId('inbox-tab-requests').click();
  await creator.getByTestId('inbox-item').first().click();
  await expect(creator.getByTestId('chat-request-banner')).toBeVisible();
  await creator.getByTestId('chat-accept').click();
  await expect(creator.getByTestId('chat-request-banner')).toBeHidden();

  await creator.getByTestId('chat-menu').click();
  await creator.getByTestId('chat-report').click();
  await creator.getByTestId('chat-report-spam').click();
  await expect(creator.getByTestId('toast')).toContainText('Đã gửi báo cáo');

  const ceo = await browser.newPage();
  const phone = `07${String(Date.now()).slice(-8)}`;
  await signUpWithPassword(ceo, {
    identifier: phone,
    name: 'CEO tin nhắn',
    password: 'mat-khau-ceo-e2e-123',
  });
  promoteToAdmin(phone);
  await setUpAdminTotp(ceo);
  await ceo.goto('/admin/tin-nhan');
  await ceo.getByTestId('reported-conversation').filter({ hasText: 'Người Lạ' }).first().click();
  await expect(ceo.getByTestId('reported-messages')).toContainText('Chào bạn, mình hỏi chút');
});
