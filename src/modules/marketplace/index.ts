// Hợp đồng public của module marketplace (SPEC-marketplace.md). Module khác chỉ import từ file này.
export { searchProducts, PAGE_SIZE, type MarketCard } from './search';
export { recordSale, refreshSales30d } from './stats';
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
