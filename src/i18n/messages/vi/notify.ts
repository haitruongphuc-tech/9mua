// Nhóm "notify." — thông báo trong app lưu theo khoá (lib/notifications.ts notifyKey), dịch lúc hiển thị.
export const notify = {
  'notify.followNewVideo': '{name} vừa đăng video mới',
  'notify.newComment': '{name} bình luận: {text}',
  'notify.newReply': '{name} trả lời bạn: {text}',
  'notify.voucherIssued': 'Bạn được tặng voucher mở Kiot miễn phí 1 năm!',
} as const;

export type NotifyMessages = Record<keyof typeof notify, string>;
