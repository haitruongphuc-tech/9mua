# Spec: `marketplace` — Chợ chung và trang chủ 9mua.com

> Module 7 trong `CAPABILITY-MAP.md`. Phụ thuộc `kiot`, `billing`. Thêm vào giỏ qua `orders`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Trang chủ `9mua.com` và Chợ `9mua.com/cho` gom sản phẩm của **mọi Kiot đang hoạt động** về một chỗ, để
người mua tìm thấy hàng mà không cần biết tên Kiot. Trang chủ cũng phải kéo người bán tạo Kiot.
Chợ chỉ **đọc** dữ liệu của `kiot`, không sở hữu dữ liệu sản phẩm.

### Tiêu chí chấp nhận

1. **Trang chủ `/`** (ưu tiên điện thoại):
   - Khối đầu: khẩu hiệu "Kiếm tiền trên 9mua.com dễ và nhanh nhất", ô tìm kiếm, 2 nút
     "Tạo Kiot – 26.000đ/năm" (dẫn tới `/kiot-cua-toi/tao`, chưa đăng nhập thì qua đăng ký) và "Vào Chợ".
   - Hàng danh mục: 12 danh mục có biểu tượng, bấm vào là lọc Chợ.
   - "Bán chạy": sản phẩm có nhiều lượt mua hoàn tất nhất 30 ngày qua.
   - "Mới lên Chợ": sản phẩm mới nhất.
   - "Kiot nổi bật": Kiot có nhiều đơn hoàn tất nhất 30 ngày qua.
   - Khối "Video hot" do module `creator` cung cấp.
   - Mọi con số hiển thị (số Kiot, số sản phẩm) là **số thật từ DB**, không có bộ đếm giả.
   - Màu và logo theo `docs/BRAND.md`.
2. **Chợ `/cho`**:
   - Lưới sản phẩm, cuộn vô hạn (phân trang bằng con trỏ, 24 sản phẩm mỗi lần).
   - Lọc: danh mục, khoảng giá, tỉnh/thành của Kiot.
   - Sắp xếp: Phù hợp (mặc định khi có từ khoá), Bán chạy, Mới nhất, Giá tăng, Giá giảm.
   - Mỗi thẻ sản phẩm: ảnh, tên, giá, giá gốc gạch ngang, tên Kiot, tỉnh, "Đã bán N".
     Bấm vào mở trang sản phẩm trên `<slug>.9mua.com`.
   - Bộ lọc nằm trên URL (`/cho?dm=nong-san&q=thanh+long&sx=ban-chay`), nên chia sẻ link là giữ nguyên kết quả.
3. **Tìm kiếm tiếng Việt**:
   - Gõ **có dấu hay không dấu đều ra** ("thanh long" = "thanh lòng" = "THANH LONG").
   - Chấp nhận gõ sai nhẹ ("thnah long").
   - Dùng PostgreSQL với extension `unaccent` + `pg_trgm`, chỉ mục trên tên và mô tả đã bỏ dấu.
     Không cần dịch vụ tìm kiếm riêng.
   - Mỗi lần tìm phản hồi dưới 300ms với 100.000 sản phẩm.
4. **Chỉ hiện** sản phẩm `visible`, chưa xoá, của Kiot `active` và không bị khoá. Hết hàng thì xếp
   cuối, có nhãn "Hết hàng". Sản phẩm bị admin gỡ thì không bao giờ hiện.
5. **Danh bạ Kiot `/cho/kiot`**: danh sách Kiot đang hoạt động, lọc theo tỉnh và danh mục chính, sắp theo
   đơn hoàn tất.
6. **Báo cáo vi phạm**: nút "Báo cáo" trên trang sản phẩm. Người dùng đã đăng nhập chọn lý do (hàng
   giả, cấm bán, lừa đảo, khác) kèm mô tả.
   - Mỗi người chỉ báo 1 lần cho mỗi sản phẩm.
   - Báo cáo vào hàng chờ của `admin`.
   - Sản phẩm bị **5 người khác nhau** báo cáo thì tự ẩn, chờ CEO xem.
7. **SEO**:
   - `sitemap.xml` liệt kê Kiot và sản phẩm đang hoạt động. Có `robots.txt`.
   - Thẻ meta và Open Graph cho trang chủ, Chợ, từng danh mục.
   - Trang danh mục có URL đẹp: `/cho/nong-san`.
8. **Hiệu năng**:
   - Trang chủ và trang danh mục được cache 60 giây (Next.js revalidate).
   - Ảnh dùng bản thu nhỏ 400px.
   - LCP < 2,5 giây trên 4G, CLS < 0,1.

### Hợp đồng (`src/modules/marketplace/index.ts`)

```ts
searchProducts(params: { q?; category?; priceMin?; priceMax?; province?; sort; cursor?; limit }): Promise<Page<ProductCard>>
getHomeSections(): Promise<{ bestSellers: ProductCard[]; newest: ProductCard[]; featuredKiots: KiotCard[]; stats: { kiots: number; products: number } }>
listKiots(params): Promise<Page<KiotCard>>
reportProduct(userId, productId, reason, message): Promise<Result>
listReports(filter): Promise<Page<ReportView>>      // cho admin
```

Số "Đã bán" và "Bán chạy" lấy từ bảng tổng hợp `ProductSalesStat(productId, sold30d, soldTotal)`.
Bảng này được cập nhật trong hook `orders.onOrderCompleted`, nên Chợ không phải đếm lại đơn mỗi lần mở trang.

## Phụ thuộc mới

Không có thư viện npm mới. Cần bật extension PostgreSQL `unaccent` và `pg_trgm` bằng migration.
Cả hai có sẵn trong image Postgres chính thức.

## Testing Strategy (riêng module)

- **Unit:** chuẩn hoá từ khoá (bỏ dấu, `đ` → `d`, gộp khoảng trắng), đọc và ghi bộ lọc trên URL.
- **Integration (Postgres thật):**
  - "thanh long", "THANH LONG", "thanh lòng", "thnah long" đều tìm ra "Thanh Long Bình Thuận".
  - Sản phẩm của Kiot hết hạn, bị khoá, `hidden`, đã xoá hay bị gỡ đều **không** xuất hiện.
  - Hết hàng xếp cuối.
  - Phân trang con trỏ không trùng và không sót sản phẩm khi có sản phẩm mới chen vào giữa chừng.
  - 5 báo cáo từ 5 tài khoản khác nhau thì tự ẩn. 1 tài khoản báo 5 lần không tính.
  - Đơn hoàn tất thì "Đã bán" tăng đúng số lượng.
- **Hiệu năng:** seed 100.000 sản phẩm, tìm kiếm p95 < 300ms.
- **E2E:** trang chủ → gõ "thanh long" → lọc Nông sản → mở sản phẩm trên trang Kiot → thêm vào giỏ.

## Boundaries (bổ sung)

- **Luôn làm:** chỉ đọc qua hợp đồng của `kiot`. Mọi truy vấn có `LIMIT`.
- **Hỏi trước:**
  - Sản phẩm trả tiền để lên top (quảng cáo).
  - Dùng dịch vụ tìm kiếm ngoài (Meilisearch, Algolia).
- **Không bao giờ:**
  - Hiện số liệu giả (bộ đếm tự tăng, "9.999 người đã thuê").
  - Cho Kiot không hoạt động lên Chợ.

## Success Criteria

- [ ] Gõ không dấu vẫn tìm ra sản phẩm có dấu, gõ sai 1 chữ vẫn ra.
- [ ] Không bao giờ thấy sản phẩm của Kiot hết hạn hoặc bị khoá trên Chợ.
- [ ] Trang chủ và Chợ đạt LCP < 2,5 giây trên điện thoại 4G.
- [ ] Mọi con số trên trang chủ là số thật.
- [ ] Link Chợ có bộ lọc chia sẻ qua Zalo mở ra đúng kết quả.

## Open Questions

Không có. Quảng cáo trả tiền để lên top để sau MVP.
