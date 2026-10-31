import { now } from './clock';
import { db } from './db';

// Thông báo mới (SPEC-social.md V5.5): mỗi loại bật/tắt được trong Cài đặt (mặc định bật hết). Follow mới và lượt thích
// cùng một video gộp theo giờ: "Như Huỳnh và 4 người khác đã follow bạn"; mỗi video tối đa 1 thông báo thích mỗi giờ.
export const NOTIFY_TYPES = [
  'follow',
  'like',
  'mention',
  'video_reply',
  'follow_request',
  'event',
  'episode',
  'repost',
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];
const GROUP_MS = 3_600_000;

export async function notifyEnabled(userId: string, type: NotifyType): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { notifyOff: true } });
  return Boolean(u) && !u!.notifyOff.includes(type);
}

export async function setNotifyTypes(userId: string, on: string[]): Promise<void> {
  const off = NOTIFY_TYPES.filter((t) => !on.includes(t));
  await db.user.update({ where: { id: userId }, data: { notifyOff: off } });
}

export async function notifyOffTypes(userId: string): Promise<NotifyType[]> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { notifyOff: true } });
  return (u?.notifyOff ?? []).filter((t): t is NotifyType => NOTIFY_TYPES.includes(t as NotifyType));
}

// Gửi thông báo theo loại. group: cùng groupKey trong 1 giờ thì cập nhật thông báo cũ (tên người mới nhất + số người
// khác) thay vì tạo thông báo mới. Không bao giờ ném lỗi ra luồng chính.
export async function notifyEvent(input: {
  userId: string;
  type: NotifyType;
  key: string; // khoá từ điển khi chỉ 1 người
  groupedKey?: string; // khoá khi gộp nhiều người: biến {name}, {others}
  vars: Record<string, string | number> & { name?: string };
  url?: string;
  groupKey?: string;
}): Promise<void> {
  try {
    if (!(await notifyEnabled(input.userId, input.type))) return;
    const t = now();
    if (input.groupKey) {
      const recent = await db.notification.findFirst({
        where: {
          userId: input.userId,
          groupKey: input.groupKey,
          createdAt: { gte: new Date(t.getTime() - GROUP_MS) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) {
        const count = recent.count + 1;
        await db.notification.update({
          where: { id: recent.id },
          data: {
            count,
            title: `@${input.groupedKey ?? input.key}`,
            body: JSON.stringify({ ...input.vars, others: count - 1 }),
            readAt: null,
            createdAt: t,
          },
        });
        return;
      }
    }
    await db.notification.create({
      data: {
        userId: input.userId,
        title: `@${input.key}`,
        body: JSON.stringify(input.vars).slice(0, 1000),
        url: input.url,
        kind: input.type,
        groupKey: input.groupKey ?? null,
        createdAt: t,
      },
    });
  } catch (e) {
    console.error('[notifications] không lưu được thông báo:', e);
  }
}
