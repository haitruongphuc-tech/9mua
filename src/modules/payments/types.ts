export type Purpose = 'kiot_fee' | 'order';

export type PaymentIntentView = {
  intentId: string;
  orderCode: number;
  purpose: Purpose;
  refId: string;
  amount: number;
  description: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'mismatch';
  checkoutUrl: string;
  qrCode: string;
  expiresAt: Date;
  paidAt: Date | null;
  amountPaid: number | null;
};

// Thông tin module nghiệp vụ nhận được khi tiền đã vào đủ.
export type PaidIntent = {
  intentId: string;
  orderCode: number;
  purpose: Purpose;
  refId: string;
  amount: number;
  paidAt: Date;
};
