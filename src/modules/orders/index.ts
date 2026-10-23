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
export { onOrderCompleted, type CompletedOrder, type CompletionHook } from './hooks';
export { ORDER_STATUSES, nextStatus, type OrderAction, type ActorRole } from './state-machine';
