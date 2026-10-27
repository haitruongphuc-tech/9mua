import { now } from './clock';
import { db } from './db';

// Thông báo trong app cho người dùng (video xử lý xong, video bị gỡ…). Không bao giờ ném lỗi ra luồng chính.
export async function notify(userId: string, title: string, body = '', url?: string): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, title: title.slice(0, 200), body: body.slice(0, 1000), url, createdAt: now() },
    });
  } catch (e) {
    console.error('[notifications] không lưu được thông báo:', e);
  }
}

// Thông báo theo khoá từ điển (SPEC-i18n.md): hiện đúng ngôn ngữ người xem đang chọn. Lưu title = "@khoá",
// body = biến dạng JSON; trang Thông báo dịch lúc hiển thị. Thông báo cũ (chữ thường) vẫn hiện như cũ.
export async function notifyKey(
  userId: string,
  key: string,
  vars: Record<string, string | number> = {},
  url?: string,
): Promise<void> {
  await notify(userId, `@${key}`, JSON.stringify(vars), url);
}

export function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export function listNotifications(userId: string, take = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take });
}

export async function markAllRead(userId: string): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now() } });
}
