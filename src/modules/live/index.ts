// Hợp đồng public của module live (SPEC-live.md). Module khác chỉ import từ file này.
export {
  startLive,
  endLive,
  finishLive,
  myOpenLive,
  getLive,
  activeLiveBan,
  MAX_TITLE,
  type StartError,
} from './session';
export {
  heartbeat,
  authorizeMedia,
  syncWithMediaServer,
  viewerKey,
  HEARTBEAT_MS,
  ACTIVE_WINDOW_MS,
  type Viewer,
} from './viewers';
export {
  sendChat,
  hideChat,
  banFromChat,
  sendHearts,
  pinProduct,
  cleanupLiveChat,
  hasLink,
  MAX_CHAT,
} from './chat';
export {
  reportLive,
  stopLive,
  banUserFromLive,
  listLivesForAdmin,
  LIVE_REPORT_REASONS,
  type LiveReportReason,
} from './moderation';
export {
  listLiveNow,
  liveIdOfHost,
  anyLiveNow,
  getLiveForViewer,
  liveState,
  recentChat,
  liveSummary,
  type LiveCard,
  type LiveView,
  type LiveState,
  type ChatLine,
  type PinnedCard,
  type LiveHost,
} from './view';
export { onLiveEnded, type LiveEndedHook } from './hooks';
export { fakeMedia } from './media';
