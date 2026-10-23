// Hợp đồng public của module kiot (SPEC-kiot.md). Module khác chỉ import từ file này.
export { slugify, validateSlug, SLUG_MIN, SLUG_MAX } from './slug';
export {
  createKiot,
  updateKiot,
  isSlugAvailable,
  getKiotByOwner,
  getKiotBySlug,
  kiotStatus,
  isKiotActive,
  type KiotStatus,
  type KiotInput,
} from './kiot';
export { CATEGORIES, categoryName, type CategorySlug } from './categories';
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
