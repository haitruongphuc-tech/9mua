import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name} just posted a new video',
  'notify.newComment': '{name} commented: {text}',
  'notify.newReply': '{name} replied to you: {text}',
  'notify.voucherIssued': 'You got a voucher for a free 1-year Kiot!',
  'notify.videoReady': 'Your video is published',
  'notify.videoDraftReady': 'Your video is processed and saved in Drafts',
  'notify.videoScheduled': 'Your video is processed and will go live at the scheduled time',
  'notify.videoPublished': 'Your scheduled video is now live',
  'notify.draftExpiring': 'A draft will be deleted in {days} days',
  'notify.videoFailed': 'Your video could not be published',
  'notify.videoRemoved': 'Your video was removed',
  'notify.profileCleared': 'Your profile photo, cover photo and bio were removed for breaking the rules',
  'notify.reason': 'Reason: {reason}',
  'notify.title': 'Notifications',
  'notify.empty': 'No notifications yet.',
  'notify.xuReward': 'You earned {xu} xu thanks to {viewers} qualified viewers in your live.',
  'notify.xuSkipped.TOO_SHORT': 'Your live was shorter than the minimum, so no xu this time.',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS':
    'Your live had {viewers} qualified viewers, not enough for a xu reward.',
  'notify.xuSkipped.DAILY_LIMIT': 'You already got a xu reward today; this live adds no more.',
  'notify.xuSkipped.BUDGET': 'This month’s xu reward budget is used up; your live got no xu.',
  'notify.xuSkipped.STOPPED': 'Your live was stopped by 9MUA, so it earns no xu.',
};
