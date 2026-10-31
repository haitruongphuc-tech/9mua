// Hợp đồng public của module kiot (SPEC-kiot.md). Module khác chỉ import từ file này.
export { slugify, validateSlug, SLUG_MIN, SLUG_MAX } from './slug';
export {
  createKiot,
  updateKiot,
  updateShipping,
  isSlugAvailable,
  getKiotByOwner,
  getKiotBySlug,
  kiotStatus,
  isKiotActive,
  type KiotStatus,
  type KiotInput,
} from './kiot';
export { CATEGORIES, categoryName, type CategorySlug } from './categories';
export { PROVINCES, provinceName, type ProvinceSlug } from './provinces';
// Bổ sung 31/10/2026 (SPEC-kiot.md V5.1): vị trí Kiot.
export {
  PROVINCE_CENTERS,
  validLatLng,
  distanceKm,
  distanceSql,
  provinceCentersSql,
  kiotLatSql,
  kiotLngSql,
  roundPublic,
} from './geo';
export { setKiotLocation } from './location';
export { updateKiotAddress, setKiotImage, removeKiotImage, type KiotImageKind } from './profile';
export {
  uploadProductImage,
  createProduct,
  updateProduct,
  deleteProduct,
  listProductsForOwner,
  getProductForOwner,
  MAX_PRODUCTS_PER_KIOT,
  MAX_IMAGES_PER_PRODUCT,
  type ProductInput,
  type OwnerProduct,
} from './product';
export {
  getPublicKiot,
  getPublicProduct,
  countPublicProducts,
  kiotOwnerId,
  kiotBasics,
  listPublicProducts,
  productPath,
  PUBLIC_PRODUCT_WHERE,
  type PublicKiot,
  type ProductCard,
  type Page,
} from './public';
export { BANKS, findBank, type Bank } from './banks';
export {
  setPayoutAccount,
  getPayoutAccount,
  normalizeAccountName,
  type SetPayoutAccountResult,
} from './payout-account';
export { decrementStock, tryDecrementStock, restoreStock, OutOfStockError, type StockLine } from './stock';
export {
  lockKiot,
  unlockKiot,
  hideProduct,
  unhideProduct,
  extendActiveUntil,
  getProductForCheckout,
  type CheckoutProduct,
} from './admin';
// Bổ sung 31/10/2026 (SPEC-kiot.md V5.2): hồ sơ nguồn gốc và huy hiệu.
export {
  submitOrigin,
  latestOrigin,
  listOriginQueue,
  listApprovedOrigins,
  reviewOrigin,
  revokeOriginForKiot,
  readOriginFile,
  kiotBadges,
  remindOriginRenewal,
  ORIGIN_VALID_DAYS,
  type KiotBadges,
  type OriginError,
} from './origin';
