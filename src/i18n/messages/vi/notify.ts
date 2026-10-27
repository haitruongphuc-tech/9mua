// Nhóm "notify." — thông báo trong app lưu theo khoá (lib/notifications.ts notifyKey), dịch lúc hiển thị.
export const notify = {
  'notify.followNewVideo': '{name} vừa đăng video mới',
  'notify.newComment': '{name} bình luận: {text}',
  'notify.newReply': '{name} trả lời bạn: {text}',
  'notify.voucherIssued': 'Bạn được tặng voucher mở Kiot miễn phí 1 năm!',
  'notify.videoReady': 'Video đã đăng xong',
  'notify.videoFailed': 'Video không đăng được',
  'notify.videoRemoved': 'Video của bạn bị gỡ',
  'notify.reason': 'Lý do: {reason}',
  'notify.title': 'Thông báo',
  'notify.empty': 'Chưa có thông báo.',
} as const;

export type NotifyMessages = Record<keyof typeof notify, string>;
