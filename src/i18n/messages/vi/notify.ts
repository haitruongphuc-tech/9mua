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
  'notify.xuReward': 'Bạn được thưởng {xu} xu nhờ {viewers} người xem hợp lệ trong buổi live.',
  'notify.xuSkipped.TOO_SHORT': 'Buổi live chưa đủ thời lượng tối thiểu nên chưa được thưởng xu.',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS': 'Buổi live có {viewers} người xem hợp lệ, chưa đủ mức thưởng xu.',
  'notify.xuSkipped.DAILY_LIMIT': 'Hôm nay bạn đã được thưởng xu 1 buổi, buổi này không cộng thêm.',
  'notify.xuSkipped.BUDGET': 'Đã hết ngân sách thưởng xu tháng này, buổi live chưa được cộng xu.',
  'notify.xuSkipped.STOPPED': 'Buổi live bị 9MUA dừng nên không được thưởng xu.',
} as const;

export type NotifyMessages = Record<keyof typeof notify, string>;
