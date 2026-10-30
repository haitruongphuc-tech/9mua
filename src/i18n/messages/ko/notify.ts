import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name}님이 새 동영상을 올렸어요',
  'notify.newComment': '{name}님의 댓글: {text}',
  'notify.newReply': '{name}님이 답글을 남겼어요: {text}',
  'notify.voucherIssued': 'Kiot 1년 무료 쿠폰을 받았어요!',
  'notify.videoReady': '동영상이 올라갔어요',
  'notify.videoFailed': '동영상을 올리지 못했어요',
  'notify.videoRemoved': '내 동영상이 삭제됐어요',
  'notify.profileCleared': "규정 위반으로 프로필 사진, 커버 사진, 소개가 삭제되었습니다",
  'notify.reason': '사유: {reason}',
  'notify.title': '알림',
  'notify.empty': '아직 알림이 없어요.',
  'notify.xuReward': '라이브 유효 시청자 {viewers}명으로 {xu} xu를 받았어요.',
  'notify.xuSkipped.TOO_SHORT': '라이브가 최소 시간보다 짧아 이번에는 xu가 없어요.',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS': '유효 시청자 {viewers}명으로 xu 보상 기준에 못 미쳤어요.',
  'notify.xuSkipped.DAILY_LIMIT': '오늘 이미 xu 보상을 받아 이번 라이브는 추가되지 않아요.',
  'notify.xuSkipped.BUDGET': '이번 달 xu 보상 예산이 소진되어 이번 라이브는 xu가 없어요.',
  'notify.xuSkipped.STOPPED': '9MUA가 라이브를 중지해 xu가 없어요.',
};
