import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, TRANSITIONS, nextStatus, type OrderAction, type ActorRole } from './state-machine';

describe('máy trạng thái đơn hàng', () => {
  const allowed: [string, OrderAction, ActorRole, string][] = [
    ['pending_payment', 'pay', 'system', 'paid'],
    ['pending_payment', 'cancel', 'buyer', 'cancelled'],
    ['pending_payment', 'expire', 'system', 'cancelled'],
    ['cancelled', 'late_pay', 'system', 'paid'],
    ['cancelled', 'late_pay_no_stock', 'system', 'refund_pending'],
    ['paid', 'confirm', 'seller', 'confirmed'],
    ['paid', 'reject', 'seller', 'refund_pending'],
    ['paid', 'auto_refund', 'system', 'refund_pending'],
    ['confirmed', 'ship', 'seller', 'shipping'],
    ['confirmed', 'seller_cancel', 'seller', 'refund_pending'],
    ['shipping', 'receive', 'buyer', 'delivered'],
    ['shipping', 'auto_deliver', 'system', 'delivered'],
    ['delivered', 'dispute', 'buyer', 'disputed'],
    ['delivered', 'complete', 'system', 'completed'],
    ['disputed', 'resolve_refund', 'admin', 'refund_pending'],
    ['disputed', 'resolve_release', 'admin', 'completed'],
    ['refund_pending', 'mark_refunded', 'admin', 'refunded'],
  ];

  it.each(allowed)('%s --%s(%s)--> %s', (from, action, role, to) => {
    expect(nextStatus(from as never, action, role)).toBe(to);
  });

  it('mọi cặp (trạng thái, hành động, vai trò) không có trong bảng đều bị từ chối', () => {
    const roles: ActorRole[] = ['buyer', 'seller', 'admin', 'system'];
    const actions = Object.keys(TRANSITIONS) as OrderAction[];
    const allowedKeys = new Set(allowed.map(([f, a, r]) => `${f}|${a}|${r}`));
    let checked = 0;
    for (const from of ORDER_STATUSES)
      for (const action of actions)
        for (const role of roles) {
          checked += 1;
          const key = `${from}|${action}|${role}`;
          if (!allowedKeys.has(key)) expect(nextStatus(from, action, role), key).toBeNull();
        }
    expect(checked).toBe(ORDER_STATUSES.length * actions.length * roles.length);
  });

  it('người bán không tự đánh dấu đã nhận/hoàn tất; người mua không tự xác nhận đơn', () => {
    expect(nextStatus('shipping', 'receive', 'seller')).toBeNull();
    expect(nextStatus('delivered', 'complete', 'seller')).toBeNull();
    expect(nextStatus('paid', 'confirm', 'buyer')).toBeNull();
  });
});
