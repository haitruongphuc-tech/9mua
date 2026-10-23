import type { Order } from '@prisma/client';
import type { Tx } from '@/lib/db';

export type CompletedOrder = Pick<
  Order,
  | 'id'
  | 'code'
  | 'kiotId'
  | 'buyerId'
  | 'subtotal'
  | 'shippingFee'
  | 'total'
  | 'platformFeeRate'
  | 'completedAt'
>;
export type CompletionHook = (tx: Tx, order: CompletedOrder) => Promise<void>;

// payouts (cộng số dư) và marketplace (thống kê đã bán) đăng ký ở tầng ứng dụng (src/server/orders.ts).
const hooks: CompletionHook[] = [];

export function onOrderCompleted(hook: CompletionHook): void {
  if (!hooks.includes(hook)) hooks.push(hook);
}

export async function runCompletionHooks(tx: Tx, order: Order): Promise<void> {
  for (const hook of hooks) await hook(tx, order);
}

// Chỉ dùng trong test.
export function clearCompletionHooks(): void {
  hooks.length = 0;
}
