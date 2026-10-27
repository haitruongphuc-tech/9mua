import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name}님이 새 동영상을 올렸어요',
  'notify.newComment': '{name}님의 댓글: {text}',
  'notify.newReply': '{name}님이 답글을 남겼어요: {text}',
  'notify.voucherIssued': 'Kiot 1년 무료 쿠폰을 받았어요!',
  'notify.videoReady': '동영상이 올라갔어요',
  'notify.videoFailed': '동영상을 올리지 못했어요',
  'notify.videoRemoved': '내 동영상이 삭제됐어요',
  'notify.reason': '사유: {reason}',
  'notify.title': '알림',
  'notify.empty': '아직 알림이 없어요.',
};
