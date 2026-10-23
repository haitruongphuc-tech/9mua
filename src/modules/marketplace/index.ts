// Hợp đồng public của module marketplace (SPEC-marketplace.md). Module khác chỉ import từ file này.
export { searchProducts, PAGE_SIZE, type MarketCard } from './search';
export { recordSale, refreshSales30d } from './stats';
export {
  normalizeQuery,
  parseSearchParams,
  toSearchString,
  SORTS,
  type Sort,
  type SearchParams,
} from './query';
