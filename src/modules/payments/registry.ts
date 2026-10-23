import type { Tx } from '@/lib/db';
import type { PaidIntent, Purpose } from './types';

export type PaymentHandler = (tx: Tx, intent: PaidIntent) => Promise<void>;

// Module nghiệp vụ (billing, orders) tự đăng ký lúc khởi động, nên payments không import ngược lại chúng.
const handlers = new Map<Purpose, PaymentHandler>();

export function registerPaymentHandler(purpose: Purpose, handler: PaymentHandler): void {
  handlers.set(purpose, handler);
}

export function getPaymentHandler(purpose: Purpose): PaymentHandler | undefined {
  return handlers.get(purpose);
}

// Chỉ dùng trong test.
export function clearPaymentHandlers(): void {
  handlers.clear();
}
