// Hợp đồng public của module creator (SPEC-creator.md). Module khác chỉ import từ file này.
export {
  saveUpload,
  createVideoUpload,
  cleanupStaleUploads,
  videosToday,
  MAX_VIDEO_BYTES,
  MAX_VIDEOS_PER_DAY,
  MAX_PRODUCTS_PER_VIDEO,
  MAX_CAPTION,
  type CreateVideoResult,
} from './upload';
export { processNextJob, claimJob } from './jobs';
export { onVideoReady, type VideoReadyHook } from './hooks';
export { listStories, expireStories, type StoryGroup, type StoryItem } from './stories';
export { extractHashtags } from './hashtags';
export { feedScore } from './score';
export { myVideoStats, type MyVideo } from './mine';
export {
  getFeed,
  getVideo,
  hydrateVideos,
  recomputeScores,
  isProductTagged,
  pinVideo,
  FEED_PAGE,
  type FeedVideo,
  type FeedProduct,
  type Viewer,
} from './feed';
export { recordViews, toggleLike, likeVideo, MIN_VIEW_SECONDS } from './engagement';
export {
  reportVideo,
  deleteVideo,
  removeVideo,
  restoreVideo,
  listVideoReports,
  listFailedVideoJobs,
  VIDEO_REPORT_REASONS,
  VIDEO_AUTO_HIDE_REPORTERS,
  type VideoActionResult,
} from './moderation';
export { getCreatorProfile, getHotVideos, type CreatorProfile, type VideoThumb } from './profile';
export { searchVideos } from './search';
export { creatorStats, type CreatorStats } from './stats';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.3): quyền riêng tư từng video.
export {
  canViewVideo,
  setVideoOptions,
  visibleToSql,
  VISIBILITIES,
  isVisibility,
  type Visibility,
  type VideoOptions,
} from './visibility';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.2): Không quan tâm, lịch sử đã xem.
export {
  markNotInterested,
  viewHistory,
  removeFromHistory,
  clearViewHistory,
  setHistoryOff,
  isHistoryOff,
  MAX_NOT_INTERESTED,
} from './watching';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.3): nháp, hẹn giờ, địa điểm, ghim lên trang cá nhân, nhãn AI, sửa sau khi đăng.
export {
  changePostTiming,
  publishScheduledVideos,
  expireDrafts,
  pinToProfile,
  editVideo,
  videoForEdit,
  setVideoCover,
  countDrafts,
  placeLabel,
  scheduleOk,
  MAX_DRAFTS,
  MAX_PROFILE_PINS,
  MAX_PLACE_NAME,
  MIN_SCHEDULE_MINUTES,
  MAX_SCHEDULE_DAYS,
  type PostOptions,
  type EditVideoPatch,
  type EditVideoResult,
  type VideoForEdit,
  type TimingResult,
} from './posting';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.1): video dài, tải lên từng phần, hàng chờ short/long.
export { videoLimits, checkLongVideo, SHORT_MAX_BYTES, SHORT_MAX_SEC, type VideoLimits } from './limits';
export {
  openUploadSession,
  uploadSessionStatus,
  putUploadPart,
  completeUploadSession,
  cleanupUploadSessions,
  diskFreeRatio,
  PART_SIZE,
  MAX_OPEN_SESSIONS,
  type OpenSessionResult,
} from './chunked';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.1 mục 9–10): kho video ngoài, trang Dung lượng.
export { migrateVideosToExternal, storageStats, type MigrateResult, type StorageStats } from './storage';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.4): phụ đề tự động.
export {
  processNextCaption,
  captionsForEdit,
  saveCaptions,
  captionsForViewer,
  sttUsedThisMonthVnd,
  MAX_CAPTION_SECONDS,
  type CaptionsForEdit,
} from './captions';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.5): quay trong app, bộ lọc màu, làm đẹp.
export { LOOKS, CSS_LOOKS, cssBeauty, isLook, MAX_BEAUTY, type Look } from './look';
export { assembleRecording, SPEEDS, MAX_SEGMENTS, type AssembleResult } from './recording';
// Bổ sung 30/10/2026 (SPEC-creator.md V5.6 mục 1): chỉnh video.
export { parseEditSpec } from './edit-spec';
export {
  listSounds,
  selectableSound,
  soundPage,
  addLibrarySound,
  setSoundStatus,
  renameSound,
  adminSounds,
  MAX_LIBRARY_BYTES,
  MAX_SOUND_SEC,
  type SoundView,
  type SoundPage,
  type LibraryResult,
} from './sounds';
