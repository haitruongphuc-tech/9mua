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
  toggleCommentLike,
  unhideMutedComment,
  notifyVideoReply,
  replyCardFor,
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
export {
  createEvent,
  cancelEvent,
  setEventCover,
  upcomingEvents,
  eventPage,
  toggleEventInterest,
  remindEvents,
  reportEvent,
  listEventReports,
  resolveEventReports,
  MAX_UPCOMING_EVENTS,
  type EventCard,
  type EventInput,
  type EventError,
} from './events';
export { memoriesOf, setShowMemories } from './memories';
export {
  createGroup,
  setGroupAvatar,
  groupPage,
  joinGroup,
  leaveGroup,
  approveMember,
  setGroupAdmin,
  banMember,
  setApprovePosts,
  postToGroup,
  moderateGroupPost,
  groupFeed,
  groupAdminData,
  myGroups,
  suggestedGroups,
  myShareableVideos,
  reportGroup,
  listGroupReports,
  resolveGroupReports,
  MAX_GROUP_NAME,
  MAX_GROUP_DESCRIPTION,
  type GroupView,
  type GroupCard,
  type GroupItem,
  type GroupError,
} from './groups';
export {
  awardLikePoints,
  awardFollowPoints,
  pointBalance,
  revokeLockedPoints,
  exchangePoints,
  type PointAward,
  type ExchangeError,
} from './points';
export {
  REACTIONS,
  isReaction,
  setVideoReaction,
  setPostReaction,
  reactionSummary,
  myReaction,
  toggleRepost,
  repostsOf,
  repostedContent,
  type ReactionKind,
  type ReactionTarget,
} from './reactions';
export {
  mutualFollowers,
  followSuggestions,
  dismissSuggestion,
  likedVideos,
  likedVideoIds,
  setShowLikedVideos,
  likedTabPublic,
  mutualFollowerList,
  type PersonCard,
} from './suggest';
export {
  parseMentions,
  recordMentions,
  mentionSuggestions,
  setMentionPolicy,
  mentionPolicyOf,
  MENTION_POLICIES,
  MAX_MENTIONS,
  type MentionPolicy,
  type MentionSource,
} from './mentions';
export {
  listMutedKeywords,
  addMutedKeyword,
  removeMutedKeyword,
  foldText,
  containsMuted,
  MAX_MUTED,
} from './muted';
export { vnDay } from './day';
// Bổ sung 30/10/2026 (SPEC-social.md V5.3): chặn trên toàn web.
export { blockUser, unblockUser, listBlockedUsers, MAX_BLOCKS } from './blocks';
export { isBlockedEither } from '@/lib/blocks';
