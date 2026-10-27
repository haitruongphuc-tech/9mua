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
export { extractHashtags } from './hashtags';
export { feedScore } from './score';
export { myVideoStats, type MyVideo } from './mine';
export {
  getFeed,
  getVideo,
  recomputeScores,
  isProductTagged,
  pinVideo,
  FEED_PAGE,
  type FeedVideo,
  type FeedProduct,
  type Viewer,
} from './feed';
export { recordViews, toggleLike, MIN_VIEW_SECONDS } from './engagement';
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
