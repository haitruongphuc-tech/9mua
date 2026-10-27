import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name}刚发布了新视频',
  'notify.newComment': '{name}评论：{text}',
  'notify.newReply': '{name}回复了你：{text}',
  'notify.voucherIssued': '你获得了一张免费开Kiot一年的券！',
  'notify.videoReady': '视频已发布',
  'notify.videoFailed': '视频未能发布',
  'notify.videoRemoved': '你的视频已被下架',
  'notify.reason': '原因：{reason}',
  'notify.title': '通知',
  'notify.empty': '还没有通知。',
  'notify.xuReward': '你的直播有 {viewers} 位有效观众，获得 {xu} 金币奖励。',
  'notify.xuSkipped.TOO_SHORT': '直播时长未达最低要求，本次没有金币奖励。',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS': '直播有 {viewers} 位有效观众，未达到奖励标准。',
  'notify.xuSkipped.DAILY_LIMIT': '你今天已获得过一次金币奖励，本场不再增加。',
  'notify.xuSkipped.BUDGET': '本月金币奖励预算已用完，本场直播没有金币。',
  'notify.xuSkipped.STOPPED': '直播被 9MUA 停止，因此没有金币奖励。',
};
