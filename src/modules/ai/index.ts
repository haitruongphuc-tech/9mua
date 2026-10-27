// Hợp đồng public của module ai (SPEC-ai.md). Module khác chỉ import từ file này.
export {
  aiStatus,
  aiQuota,
  aiSelfTest,
  isStudioOwner,
  writeProductCopy,
  drawProductImages,
  type AiError,
  type AiInputError,
  type StoredImage,
} from './studio';
export {
  startSlideshow,
  slideshowStatus,
  processNextSlideshow,
  MAX_SLIDES,
  type SlideshowStatus,
} from './slideshow';
export { publishFromStudio, type StudioDraft, type PublishResult } from './publish';
export { monthlyUsage, recentUsage, type RecentUsage } from './usage';
export { cleanupAiFiles } from './cleanup';
export { captionFor, TRANSLATION_LANGS, type ProductCopy, type TranslationLang } from './prompt';
export { AI_STYLES, AI_STYLE_IDS, IMAGES_PER_DRAW, type AiStyleId } from './styles';
