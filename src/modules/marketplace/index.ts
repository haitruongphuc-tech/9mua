// Hợp đồng public của module marketplace (SPEC-marketplace.md). Module khác chỉ import từ file này.
export { searchProducts, PAGE_SIZE, type MarketCard } from './search';
// Bổ sung 31/10/2026 (SPEC-marketplace.md V5.1–V5.2): tìm Kiot, Gần tôi.
export { searchKiots, NEAR_RADII, type KiotSearchCard, type Near } from './kiot-search';
// Bổ sung 31/10/2026 (SPEC-marketplace.md V5.3): bản đồ nhiệt.
export { kiotHeatmap, validBounds, CELL_DEG, type Bounds, type HeatCell } from './heatmap';
// Bổ sung 31/10/2026 (SPEC-marketplace.md V5.4): gợi ý, lịch sử, từ khoá hot.
export {
  logSearch,
  searchHistory,
  clearSearchHistory,
  hotKeywords,
  suggest,
  cleanupSearchLog,
  type Suggestion,
} from './search-log';
export { recordSale, refreshSales30d, kiotSoldTotal } from './stats';
export { getHomeSections, listKiots, pinKiot, type HomeSections, type KiotCard } from './home';
export { listSitemapEntries } from './sitemap';
export {
  reportProduct,
  listReports,
  resolveProductReports,
  REPORT_REASONS,
  AUTO_HIDE_REPORTERS,
  AUTO_HIDE_REASON,
  type ReportResult,
  type ReportView,
} from './reports';
export {
  normalizeQuery,
  parseSearchParams,
  toSearchString,
  SORTS,
  type Sort,
  type SearchParams,
} from './query';
