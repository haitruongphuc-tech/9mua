import { describe, expect, it } from 'vitest';
import { db } from './helpers/db';

// Các chốt chặn viết tay trong migration (Prisma không quản lý). Migration mới vô tình xoá mất thì test này đỏ.
describe('chốt chặn trong database', () => {
  it('trigger chỉ-thêm của các sổ tiền và sổ bán hàng', async () => {
    const rows = await db.$queryRaw<
      { tgname: string }[]
    >`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`;
    expect(rows.map((r) => r.tgname)).toEqual(
      expect.arrayContaining([
        'payment_event_no_update_delete',
        'balance_entry_append_only',
        'platform_revenue_append_only',
        'order_event_append_only',
        'order_item_append_only',
        'ProductSale_append_only',
        'AdminAuditLog_append_only',
        'AiUsage_append_only',
        'KiotFeeRateLog_append_only',
        'Product_search_name',
      ]),
    );
  });

  it('ràng buộc CHECK về tiền và tồn kho', async () => {
    const rows = await db.$queryRaw<
      { conname: string }[]
    >`SELECT conname FROM pg_constraint WHERE contype = 'c'`;
    expect(rows.map((r) => r.conname)).toEqual(
      expect.arrayContaining([
        'Product_stock_nonnegative',
        'AiUsage_cost_nonnegative',
        'Product_price_range',
        'Order_amounts_valid',
        'OrderItem_qty_price_valid',
        'CartItem_qty_positive',
        'PayoutRequest_amounts_valid',
        'PlatformRevenue_fee_nonnegative',
        'ProductSale_qty_positive',
        'Kiot_shipping_fee_range',
        'Video_counters_nonnegative',
        'VideoProduct_position_range',
      ]),
    );
  });

  it('chỉ mục đặc biệt (tìm kiếm, 1 yêu cầu rút mở mỗi Kiot)', async () => {
    const rows = await db.$queryRaw<
      { indexname: string }[]
    >`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`;
    expect(rows.map((r) => r.indexname)).toEqual(
      expect.arrayContaining([
        'PayoutRequest_one_open_per_kiot',
        'Product_searchName_trgm',
        'Product_description_search_trgm',
        'Product_market_listing',
      ]),
    );
  });
});
