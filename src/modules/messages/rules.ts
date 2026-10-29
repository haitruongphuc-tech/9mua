// Luật Hộp thư (SPEC-messages.md, CEO duyệt 29/10/2026).
export const MAX_TEXT = 1_000;
export const MIN_GAP_MS = 1_000; // tối đa 1 tin mỗi giây
export const FREE_NEW_PER_DAY = 20; // tài khoản Free mở tối đa 20 cuộc trò chuyện mới mỗi ngày
export const NEW_ACCOUNT_MS = 86_400_000; // tài khoản dưới 1 ngày chỉ nhắn được cho chủ Kiot
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGES_PER_HOUR = 30;
export const AUTO_BAN_REPORTERS = 3; // 3 người khác nhau báo cáo trong 7 ngày → tự cấm nhắn tin 1 ngày
export const AUTO_BAN_WINDOW_MS = 7 * 86_400_000;
export const AUTO_BAN_MS = 86_400_000;
export const REPORT_REASONS = ['lua_dao', 'quay_roi', 'spam', 'khac'] as const;
export type MessageReportReason = (typeof REPORT_REASONS)[number];
