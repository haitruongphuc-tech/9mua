// Nhóm "live." — bản gốc tiếng Việt.
export const live = {
  'live.empty.title': 'Chưa có ai đang live',
  'live.empty.body': 'Tính năng Live đang được hoàn thiện. Trong lúc chờ, xem video nhé.',
  'live.empty.cta': 'Xem video',
  'live.stories': 'Story 24 giờ',
  'live.addStory': '+ Story',
  'live.storyBy': 'Story của {name}',
  'live.closeStory': 'Đóng Story',
} as const;

export type LiveMessages = Record<keyof typeof live, string>;
