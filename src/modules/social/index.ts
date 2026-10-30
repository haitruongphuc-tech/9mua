// Hợp đồng public của module social (SPEC-social.md). Module khác chỉ import từ file này.
export { isFreeAccount, consumeDailyAction, freeStatus } from './limits';
export {
  toggleFollow,
  followStats,
  followingIds,
  followingFeed,
  notifyFollowersOfVideo,
  followRelation,
  followList,
  FOLLOW_PAGE,
  type FollowPerson,
} from './follow';
export {
  addComment,
  listComments,
  commentCounts,
  pinComment,
  hideComment,
  reportComment,
  MAX_COMMENT,
  type CommentView,
} from './comments';
export { toggleSave, savedVideos, savedSet } from './saves';
export { hashtagVideos, trendingHashtags, normalizeTag, searchHashtags } from './hashtags';
export { heartVideo, toggleKiotHeart, kiotHeartStats } from './hearts';
export {
  checkVoucher,
  getVoucher,
  consumeVoucher,
  redeemVoucher,
  revokeVoucher,
  listVouchers,
  likedVideoCount,
  type VoucherView,
} from './voucher';
export {
  PLATFORMS,
  PLATFORM_LIST,
  normalizeSocialUrl,
  setSocialLinks,
  getSocialLinks,
  type Platform,
} from './connect';
export { decorateFeed, type SocialFeedVideo } from './decorate';
export { hasLink } from './links';
export { vnDay } from './day';
