export const CART_ERROR_MESSAGES = {
  UNAVAILABLE: 'Sản phẩm hiện không bán.',
  OWN_PRODUCT: 'Bạn không thể mua sản phẩm của Kiot mình.',
  CART_FULL: 'Giỏ hàng tối đa 50 món. Hãy đặt bớt trước.',
  EXCEEDS_STOCK: 'Vượt quá số lượng còn trong kho.',
  INVALID_QTY: 'Số lượng không hợp lệ.',
} as const;

export const CART_PROBLEM_MESSAGES = {
  OUT_OF_STOCK: 'Hết hàng — hãy xoá món này',
  EXCEEDS_STOCK: 'Không đủ hàng — giảm số lượng',
  UNAVAILABLE: 'Không còn bán — hãy xoá món này',
} as const;
