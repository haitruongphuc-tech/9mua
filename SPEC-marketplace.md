# Spec: `marketplace` — Chợ chung và trang chủ 9mua.com

> Module 7 trong `CAPABILITY-MAP.md`. Phụ thuộc `kiot`, `billing`. Thêm vào giỏ qua `orders`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Trang chủ `9mua.com` và Chợ `9mua.com/cho` gom sản phẩm của **mọi Kiot đang hoạt động** về một chỗ, để
người mua tìm thấy hàng mà không cần biết tên Kiot. Trang chủ cũng phải kéo người bán tạo Kiot.
Chợ chỉ **đọc** dữ liệu của `kiot`, không sở hữu dữ liệu sản phẩm.

### Tiêu chí chấp nhận

1. **Trang chủ `/` là feed video dọc kiểu TikTok** (CEO chọn 27/10/2026, `docs/v4-merge-plan.md`): nằm giữa
   thanh trên và thanh điều hướng dưới, chỉ tải trước video đang xem, có tiêu đề + đoạn giới thiệu ẩn cho Google.
   **Chưa có video nào** thì hiện các khối dưới đây. Khi Chợ chưa lọc gì, đầu `/cho` hiện số liệu + nút Tạo Kiot,
   "Bán chạy", "Video hot", "Kiot nổi bật".
   Các khối của trang chủ cũ (ưu tiên điện thoại):
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

## Bổ sung 27/10/2026 — Giới thiệu & Pháp lý, trang chính sách (T44)

- Trang `/gioi-thieu`: giới thiệu 9MUA ("99% AI vận hành - 1% CEO phê duyệt"), thông tin công ty lấy từ cài đặt pháp lý
  của CEO (`SPEC-admin.md`), không vẽ con dấu, không có STK cá nhân.
- Trang `/chinh-sach/<loai>`: quy chế hoạt động, điều khoản sử dụng, bảo mật thông tin, đổi trả & hoàn tiền, giải quyết
  khiếu nại, vận chuyển, thanh toán. Nội dung do Claude viết nháp theo cách 9MUA đang vận hành thật; **CEO đọc duyệt trước
  khi deploy**.
- Chân trang có link tới các trang này.
- Ghi chú khi làm (T68, 27/10/2026): nội dung nằm ở `src/content/legal/` (bản tiếng Việt là bản chính, có bản tiếng
  Anh). Phí, hotline, địa chỉ… điền tự động từ cài đặt nên đổi ở `/admin` là trang chính sách đổi theo. Tiếng Trung,
  Nhật, Hàn, Pháp, Tây Ban Nha dịch **sau khi CEO duyệt bản tiếng Việt** (tránh dịch lại); trong lúc chờ, trang hiện
  bản tiếng Việt kèm dòng báo chưa có bản dịch.


## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: chờ CEO duyệt.** Quyết định, công tắc, thư viện, dữ liệu: `docs/nang-cap-mot-dot.md`. Hình: M6.

### V5.1 Tìm Kiot theo tên (C12, C15) — công tắc `feature.search_more`

1. Trang `/tim-kiem` (Đợt A) thêm tab **Kiot**; Danh bạ Kiot `/cho/kiot` thêm ô tìm.
2. Tìm theo tên và giới thiệu Kiot, không cần dấu, chấp nhận gõ sai nhẹ (cùng cách tìm sản phẩm: `unaccent` + `pg_trgm`).
   Chỉ Kiot đang hoạt động.
3. Thẻ Kiot trong kết quả: logo, tên, huy hiệu (`SPEC-kiot.md` V5.2), số sao và số đánh giá (khi có từ 3 đánh giá,
   `SPEC-orders.md` V5.1), **khoảng giá** (giá thấp nhất – cao nhất của sản phẩm đang hiện), tỉnh, khoảng cách khi bật Gần tôi.

### V5.2 Gần tôi (C13)

1. Chip "Gần tôi" ở tab Kiot và tab Sản phẩm. Bấm thì xin quyền vị trí của trình duyệt. Từ chối thì báo và giữ kết quả thường.
2. Vị trí người mua **chỉ dùng để tính khoảng cách trong lần tìm đó**: không lưu máy chủ, không ghi vào `SearchLog`.
3. Lọc bán kính 1 · 3 · 5 · 10 · 20 · 50 km; xếp gần nhất trước. Khoảng cách tính bằng công thức haversine trong SQL
   (không cần PostGIS).
4. Kiot chưa đặt ghim (`geoSource = 'province'`) tính theo tâm tỉnh và ghi "khoảng 12 km".
5. Lọc "Khu vực": chọn tỉnh (đang có) và gõ tên phường/xã hoặc địa danh, khớp với địa chỉ lấy hàng của Kiot.
6. Lọc số sao: "★ 4+" chỉ lấy Kiot có trung bình từ 4 sao.

### V5.3 Bản đồ nhiệt (C14) — công tắc `feature.map`

1. Tab Kiot có nút "Bản đồ". Bản đồ dùng `leaflet`, ảnh nền lấy từ `MAP_TILE_URL` (dev dùng OpenStreetMap).
2. Máy chủ đếm Kiot đang hoạt động theo ô lưới khoảng 1,1 km (0,01 độ) trong khung đang xem; trình duyệt vẽ vòng tròn,
   càng nhiều Kiot càng đậm. Có chấm xanh vị trí người xem (khi đã cho phép) và chú thích "Màu đậm = nhiều Kiot".
3. Bấm một ô: danh sách Kiot trong ô đó.
4. Điểm của từng Kiot hiện ở vị trí làm tròn khoảng 500m, trừ khi chủ Kiot chọn "Hiện vị trí cửa hàng chính xác"
   (`SPEC-kiot.md` V5.1).
5. Kết quả đếm lưu đệm 5 phút.

### V5.4 Gợi ý từ khoá, lịch sử tìm, từ khoá hot, micro (C38, C74)

1. **Gợi ý khi gõ:** tối đa 8 gợi ý từ tên sản phẩm, tên Kiot, hashtag, @tên; trả về dưới 150ms.
2. **Lịch sử tìm:** người đã đăng nhập thấy 20 từ khoá gần nhất, xoá từng cái hoặc xoá hết.
3. **Từ khoá đang hot:** 10 từ khoá được nhiều người khác nhau tìm nhất trong 7 ngày (tối thiểu 5 người). CEO có danh sách
   từ không cho hiện ở `/admin/noi-dung`.
4. **Micro (C38):** nút micro dùng nhận dạng giọng nói sẵn có của trình duyệt (tiếng Việt). Trình duyệt không hỗ trợ thì ẩn
   nút. Không gửi tiếng nói về máy chủ 9MUA.
5. Bảng `SearchLog` (userId hoặc mã ẩn danh, từ khoá đã chuẩn hoá, tab, số kết quả, createdAt). Không lưu vị trí. Xoá dòng
   cũ hơn 90 ngày.

### Hợp đồng mới của `marketplace` (chỉ thêm)

```ts
searchKiots(params: { q?; province?; area?; near?: { lat; lng; radiusKm }; minStars?; cursor? }): Promise<Page<KiotCard>>
searchProducts(params: { ...cũ; near?: { lat; lng; radiusKm } })   // thêm tham số, không đổi kết quả khi không truyền
kiotHeatmap(bounds, zoom): Promise<{ cells: { lat; lng; count }[] }>
suggest(q, viewerId?): Promise<Suggestion[]>; searchHistory(userId); clearSearchHistory(userId, q?); hotKeywords()
```

### Kiểm thử V5 (riêng `marketplace`)

- Tìm "minh ha" ra "Điện Máy Minh Hà"; Kiot hết hạn không ra.
- Khoảng cách đúng với toạ độ mẫu (sai số < 1%); lọc 5 km bỏ Kiot ở 6 km; Kiot chưa có ghim ghi "khoảng".
- Vị trí người mua không xuất hiện trong bất kỳ bảng nào sau khi tìm.
- Ô lưới đếm đúng; Kiot không chọn hiện chính xác thì toạ độ trả về đã làm tròn.
- Từ khoá hot cần đủ 5 người khác nhau; từ trong danh sách cấm không hiện.
