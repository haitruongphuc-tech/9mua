// Hợp đồng public của module orders (SPEC-orders.md). Module khác chỉ import từ file này.
export {
  addToCart,
  updateCartQty,
  removeFromCart,
  getCart,
  MAX_CART_LINES,
  type Cart,
  type CartGroup,
  type CartLine,
  type CartProblem,
  type CartSource,
} from './cart';
export { shippingFeeFor } from './shipping';
export {
  placeOrder,
  onOrderPaid,
  cancelCheckout,
  getCheckoutForBuyer,
  getSavedAddress,
  expireUnpaidOrders,
  PAYMENT_TTL_MINUTES,
  type PlaceOrderResult,
} from './place-order';
export { parseAddress, type Address, type AddressField } from './address';
export {
  transition,
  listOrdersForKiot,
  getOrderForSeller,
  type TransitionResult,
  type TransitionPayload,
  type ActorInput,
} from './transition';
export { onOrderCompleted, type CompletedOrder, type CompletionHook } from './hooks';
export {
  listOrdersForBuyer,
  getOrderForBuyer,
  uploadDisputeImage,
  submitDispute,
  setRefundAccount,
  listRefundsPending,
  listDisputes,
  DISPUTE_WINDOW_DAYS,
} from './buyer';
export { runOrderTick } from './tick';
export { ORDER_STATUSES, nextStatus, type OrderAction, type ActorRole } from './state-machine';
// Bổ sung 31/10/2026 (SPEC-orders.md V5.1): đánh giá sản phẩm, sao Kiot.
export {
  canReviewItem,
  createReview,
  editReview,
  replyReview,
  reportReview,
  listReviewReports,
  resolveReviewReports,
  productReviews,
  kiotRating,
  myReview,
  reviewsForKiot,
  remindReviews,
  MAX_REVIEW_TEXT,
  MAX_REPLY_TEXT,
  KIOT_STARS_MIN_REVIEWS,
  type ReviewView,
  type ReviewSummary,
  type ReviewError,
} from './reviews';
// Bổ sung 31/10/2026 (SPEC-orders.md V5.2): tố cáo hàng giả.
export {
  submitFakeReport,
  respondFakeReport,
  fakeReportsForKiot,
  myFakeReports,
  listFakeReportQueue,
  getFakeReport,
  closeFakeReport,
  fakeReportBannedUntil,
  fakeReportOrder,
  ordersWithProduct,
  overdueFakeReports,
  FAKE_REASONS,
  SELLER_RESPONSE_HOURS,
  type FakeReportError,
} from './fake-reports';
