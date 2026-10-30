import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name}さんが新しい動画を投稿しました',
  'notify.newComment': '{name}さんのコメント：{text}',
  'notify.newReply': '{name}さんがあなたに返信：{text}',
  'notify.voucherIssued': 'Kiot 1年無料のクーポンが届きました！',
  'notify.videoReady': '動画の投稿が完了しました',
  'notify.videoFailed': '動画を投稿できませんでした',
  'notify.videoRemoved': '動画が削除されました',
  'notify.profileCleared': "規約違反のため、プロフィール写真・カバー写真・自己紹介が削除されました",
  'notify.reason': '理由：{reason}',
  'notify.title': 'お知らせ',
  'notify.empty': 'お知らせはまだありません。',
  'notify.xuReward': 'ライブの有効視聴者 {viewers} 人で {xu} xu を獲得しました。',
  'notify.xuSkipped.TOO_SHORT': 'ライブが最低配信時間に届かなかったため、xu はありません。',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS': '有効視聴者が {viewers} 人で、xu の付与基準に届きませんでした。',
  'notify.xuSkipped.DAILY_LIMIT': '本日はすでに xu を獲得しているため、このライブでは付与されません。',
  'notify.xuSkipped.BUDGET': '今月の xu 予算が上限に達したため、このライブでは付与されません。',
  'notify.xuSkipped.STOPPED': 'ライブが 9MUA により停止されたため、xu はありません。',
};
