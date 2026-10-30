# Spec: `kiot` — Kiot, sản phẩm, trang Kiot công khai

> Module 2 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`.
> Tech stack, lệnh, cấu trúc, code style, test và ranh giới chung theo `SPEC-identity.md`.
> Spec này chỉ ghi phần riêng của module.

## Objective

Cho một tài khoản tạo Kiot của mình: đặt tên, chọn địa chỉ `tenkiot.9mua.com`, đăng sản phẩm có ảnh,
giá, tồn kho, và khai báo tài khoản ngân hàng để 9mua trả tiền bán hàng. Khi Kiot đã đóng phí và còn
hạn (module `billing` quyết định), trang Kiot hiện công khai cho người mua.

### Trạng thái Kiot

| Trạng thái | Nghĩa | Công khai? | Chủ Kiot sửa được? |
|---|---|---|---|
| `draft` | Mới tạo, chưa đóng phí | Không (chủ xem trước được) | Có |
| `active` | Đã đóng phí, `activeUntil` > hiện tại | Có | Có |
| `expired` | Quá `activeUntil` | Không, hiện "Kiot tạm ngưng" | Có, nhưng phải gia hạn mới mở lại |
| `locked` | CEO khoá | Không, hiện "Kiot tạm ngưng" | Không |

`active` / `expired` được **tính từ `activeUntil`** chứ không lưu cứng, nên không cần tác vụ định kỳ để
chuyển trạng thái. `locked` là cờ `lockedAt` riêng.

### User stories & tiêu chí chấp nhận

1. **Tạo Kiot** tại `/kiot-cua-toi/tao`. Mỗi tài khoản có tối đa 1 Kiot trong MVP.
   - Nhập: tên Kiot (2–60 ký tự), slug, mô tả ngắn (≤ 500 ký tự), SĐT/Zalo liên hệ.
   - Slug gợi ý tự động từ tên, bỏ dấu tiếng Việt (`Thanh Long Bình Thuận` → `thanh-long-binh-thuan`).
   - Slug dài 3–30 ký tự, chỉ gồm `a-z 0-9 -`, không bắt đầu hay kết thúc bằng `-`, không trùng Kiot khác.
   - Slug không được nằm trong danh sách cấm: `www api admin ceo cho app mail static cdn uploads
     9mua help hotro dang-nhap dang-ky tai-khoan kiot ...` (đầy đủ trong `reserved-slugs.ts`).
   - Trang tạo kiểm tra slug còn trống ngay khi gõ.
   - Slug **chỉ đổi được khi còn `draft`**. Sau khi kích hoạt thì cố định để link và QR đã in không bị hỏng.
2. **Thông tin Kiot**: logo và ảnh bìa (tuỳ chọn), địa chỉ lấy hàng (tỉnh/thành, quận/huyện, địa chỉ
   chi tiết), mô tả.
3. **Tài khoản nhận tiền**: chọn ngân hàng (danh sách ngân hàng VietQR), số tài khoản, tên chủ tài khoản
   (viết hoa, không dấu).
   - Đổi tài khoản nhận tiền phải **nhập lại mật khẩu**.
   - Đổi xong hệ thống gửi email báo cho chủ Kiot, để phát hiện kẻ gian đổi tài khoản.
   - Mỗi lần đổi được lưu lịch sử. `payouts` dùng lịch sử này để tạm giữ tiền 24 giờ sau khi đổi.
4. **Sản phẩm** (CRUD) tại `/kiot-cua-toi/san-pham`:
   - Trường: tên (2–120), mô tả (≤ 5.000), giá bán (số nguyên VNĐ, 1.000–100.000.000), giá gốc gạch
     ngang (tuỳ chọn, phải lớn hơn giá bán), tồn kho (số nguyên ≥ 0), danh mục, 1–6 ảnh,
     trạng thái `visible` / `hidden`.
   - Ảnh: JPG/PNG/WebP ≤ 10MB. (HEIC: bản `sharp` dựng sẵn không có codec HEVC, nên ô chọn ảnh chỉ khai báo
     JPG/PNG/WebP để iPhone tự đổi HEIC sang JPEG trước khi tải lên. File HEIC lọt tới server bị từ chối kèm
     hướng dẫn. Quyết định ở T9, ngày 23/10/2026.) Server chuyển sang WebP, cạnh dài tối đa 1200px, tạo thêm bản
     thu nhỏ 400px, xoá metadata EXIF (có thể chứa vị trí GPS). Tên file ngẫu nhiên. Chủ Kiot kéo thả
     để đổi thứ tự ảnh.
   - Tối đa 500 sản phẩm mỗi Kiot.
   - Xoá sản phẩm là **xoá mềm** (`deletedAt`), vì đơn hàng cũ vẫn tham chiếu tới sản phẩm đó.
   - MVP chưa có biến thể (size/màu). Mỗi biến thể là một sản phẩm riêng.
5. **Danh mục**: danh sách cố định do 9mua quy định, khoảng 12 mục (Thực phẩm & Đặc sản, Thời trang,
   Mỹ phẩm, Đồ gia dụng, Điện tử, Mẹ & Bé, Sức khoẻ, Thủ công mỹ nghệ, Nông sản, Sách & VPP,
   Thú cưng, Khác). CEO đổi được ở giai đoạn sau.
6. **Trang Kiot công khai** `https://<slug>.9mua.com` (đồng thời có ở `https://9mua.com/k/<slug>`):
   - Header có logo, tên, mô tả, nút gọi / Zalo. Bên dưới là lưới sản phẩm `visible` còn hàng, hết
     hàng thì hiện mờ.
   - Trang chi tiết sản phẩm `<slug>.9mua.com/p/<productId>-<ten-khong-dau>` có ảnh, giá, mô tả và nút
     "Thêm vào giỏ" (nút này do module `orders` gắn vào).
   - Có thẻ meta và Open Graph để chia sẻ Facebook/Zalo hiện đúng ảnh và giá.
   - Kiot không `active` thì trả trang "Kiot tạm ngưng" với mã HTTP 404 (để bỏ khỏi chỉ mục tìm kiếm).
   - Có nút tạo **QR dẫn tới trang Kiot** (QR của đường link, không phải QR chuyển khoản) để in dán
     tại quầy.
7. **Bảng điều khiển** `/kiot-cua-toi`: trạng thái Kiot, ngày hết hạn, nút "Kích hoạt / Gia hạn"
   (gọi `billing`), số sản phẩm, link xem trang Kiot. Các tab Đơn hàng và Số dư do `orders` và
   `payouts` gắn vào.

### Định tuyến tên miền phụ

`middleware.ts` đọc header `Host`:
- `<slug>.9mua.com` được rewrite nội bộ sang `/k/<slug>/...`.
- `9mua.com` và `www.9mua.com` đi theo route bình thường.

Cookie phiên đăng nhập có domain `.9mua.com`, nên người dùng vẫn đăng nhập khi sang trang Kiot.
Ở dev dùng `<slug>.localhost:3000`.

### Hợp đồng cho module khác (`src/modules/kiot/index.ts`)

```ts
getKiotBySlug(slug: string): Promise<KiotPublic | null>
getKiotByOwner(userId: string): Promise<Kiot | null>
isKiotActive(kiot: Pick<Kiot, 'activeUntil' | 'lockedAt'>, now?: Date): boolean
extendActiveUntil(kiotId: string, until: Date): Promise<void>        // chỉ billing gọi
lockKiot(kiotId: string, reason: string): Promise<void>              // chỉ admin gọi
unlockKiot(kiotId: string): Promise<void>
listPublicProducts(filter: { kiotId?: string; category?: string; q?: string; cursor?: string; limit: number }): Promise<Page<ProductCard>>
getProductForCheckout(productId: string): Promise<{ id; kiotId; name; price; stock; active: boolean } | null>
decrementStock(tx: Tx, items: { productId: string; qty: number }[]): Promise<{ ok: true } | { ok: false; productId: string }>
restoreStock(tx: Tx, items: { productId: string; qty: number }[]): Promise<void>
getPayoutAccount(kiotId: string): Promise<{ bankBin; accountNumber; accountName; changedAt: Date } | null>
hideProduct(productId: string, reason: string): Promise<void>       // admin gỡ vi phạm
```

`decrementStock` chạy **trong transaction của `orders`**, dùng `UPDATE … SET stock = stock - qty WHERE stock >= qty`.
Hai người mua cùng lúc món cuối cùng thì chỉ một người thành công, tồn kho không bao giờ âm.

### Lưu trữ ảnh

- Ảnh lưu ở thư mục `UPLOAD_DIR` (trong container là `/data/uploads`), gắn ra host `/srv/9mua/uploads`.
- Nginx trên host phục vụ trực tiếp `https://9mua.com/uploads/...`, cache 1 năm (tên file không bao giờ trùng).
- Code ghi ảnh qua interface `ImageStore`, để sau này chuyển sang Cloudflare R2 mà không phải sửa module.

## Phụ thuộc mới (cần duyệt)

- `sharp`: xử lý ảnh (đổi định dạng, thu nhỏ, xoá EXIF).
- `qrcode`: tạo QR link Kiot.
- `slugify` **không dùng**: tự viết hàm bỏ dấu tiếng Việt khoảng 15 dòng.

## Testing Strategy (riêng module)

- **Unit:**
  - Tạo slug từ tên tiếng Việt (có `đ`, dấu, ký tự đặc biệt).
  - Kiểm tra slug (độ dài, ký tự, danh sách cấm).
  - `isKiotActive` ở các mốc thời gian.
  - Kiểm tra giá và giá gốc.
- **Integration:**
  - Tạo Kiot: trùng slug thì bị từ chối, tài khoản đã có Kiot không tạo thêm được.
  - Đổi slug: được khi `draft`, không được khi đã kích hoạt.
  - Đổi tài khoản nhận tiền: sai mật khẩu thì bị từ chối, đổi xong có lịch sử và có gửi mail.
  - **Tồn kho:** 20 lệnh `decrementStock` đồng thời trên sản phẩm có tồn kho 5 thì đúng 5 lệnh thành
    công, tồn kho cuối bằng 0.
  - Người khác không sửa hay xoá được sản phẩm của Kiot không thuộc mình.
  - Ảnh tải lên không còn EXIF, và file không phải ảnh (đổi đuôi `.jpg`) bị từ chối.
- **E2E:** tạo Kiot → thêm sản phẩm có ảnh → (giả lập `extendActiveUntil`) → mở `slug.localhost:3000`
  thấy sản phẩm → khoá Kiot → thấy trang "Kiot tạm ngưng".

## Boundaries (bổ sung)

- **Luôn làm:**
  - Kiểm tra quyền sở hữu Kiot ở **server** cho mọi thao tác sửa.
  - Kiểm tra nội dung ảnh thật (magic bytes), không tin đuôi file.
- **Hỏi trước:**
  - Cho phép nhiều Kiot trên một tài khoản.
  - Thêm biến thể sản phẩm.
  - Đổi danh sách danh mục.
- **Không bao giờ:**
  - Cho đổi slug sau khi Kiot đã kích hoạt.
  - Xoá cứng sản phẩm đã có đơn hàng.
  - Hiển thị số tài khoản ngân hàng của người bán ra trang công khai.

## Success Criteria

- [ ] Tạo Kiot "Thanh Long Bình Thuận" thì gợi ý slug `thanh-long-binh-thuan`. Slug `admin`, `www` hay
      slug đã có người dùng đều bị từ chối.
- [ ] Kiot `draft`: chủ Kiot xem trước được, người khác vào `slug.9mua.com` thấy 404.
- [ ] Sau `extendActiveUntil`, trang `slug.9mua.com` hiện sản phẩm. Quá hạn hoặc bị khoá thì hiện "Kiot tạm ngưng".
- [ ] Ảnh điện thoại 8MB tải lên thành WebP ≤ 300KB và không còn GPS.
- [ ] Tồn kho không bao giờ âm khi nhiều người mua cùng lúc (theo test đồng thời ở trên).
- [ ] Chia sẻ link sản phẩm lên Zalo/Facebook hiện đúng ảnh, tên, giá.
- [ ] Trang Kiot trên điện thoại 4G tải xong nội dung chính dưới 2,5 giây (LCP).

## Quyết định đã chốt (trước đây là Open Questions)

1. Mỗi tài khoản **1 Kiot** trong MVP.
2. Dùng 12 danh mục như đã liệt kê.
3. Chưa yêu cầu KYC khi tạo Kiot. Xác minh CCCD khi người bán **rút tiền lần đầu** (module `payouts`).
4. Thêm hai dependency `sharp` và `qrcode`.

## Bổ sung 27/10/2026 — Trang Kiot kiểu V4, link mạng xã hội (CEO duyệt qua chat)

### Trang Kiot (T42)
- Bố cục V4: ảnh bìa, avatar tròn viền đen dày, tên Kiot (font tiêu đề), `@slug · tên chủ`, hàng số liệu
  **Followers · Tim · Sản phẩm · Đã bán** (không hiện điểm đánh giá khi chưa có đánh giá thật), giới thiệu kèm hashtag, tỉnh.
- Hàng nút: **Follow** (cam, rộng), **Nhắn** (mở Zalo/gọi của Kiot), **Tim**, **Chia sẻ** (có mã QR).
- 3 tab: **Video** (video của chủ Kiot), **Sản phẩm** (thẻ trắng, nút "+ Giỏ"), **Live** (đang live thì vào xem, chưa thì
  báo chưa live). Mặc định tab Sản phẩm.
- Nhãn "LIVE" đỏ trên avatar khi chủ Kiot đang live (`SPEC-live.md`).

### Social Connect (thay bản giả của V4)
- Trang `/ket-noi`: người dùng dán link trang của mình trên **TikTok, Facebook, Instagram, YouTube, Shopee, Zalo**. Máy chủ
  kiểm link đúng tên miền của từng mạng.
- Link hiện thành nút tròn trên trang creator và trang Kiot.
- **Không** hiện số follower hay "giá trị tài khoản" của các mạng đó: kết nối thật cần từng mạng duyệt ứng dụng (nhiều
  tuần), làm sau nếu CEO muốn (hỏi trước).
- Dữ liệu: bảng mới `SocialLink`: (userId, platform) khoá chính, url, createdAt.

## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: chờ CEO duyệt.** Quyết định, công tắc, thư viện, dữ liệu: `docs/nang-cap-mot-dot.md`. Hình: M7, M8.

### V5.1 Vị trí Kiot (dùng cho C13, C14)

1. Cột mới `Kiot.lat`, `Kiot.lng`, `Kiot.geoSource` (`pin` | `province`), `Kiot.showExactLocation` (mặc định tắt).
2. Trong `/kiot-cua-toi/cai-dat`, chủ Kiot đặt ghim trên bản đồ (khi `feature.map` bật) hoặc bấm "Dùng vị trí hiện tại".
3. Chưa đặt ghim: dùng tâm tỉnh của địa chỉ lấy hàng (`geoSource = 'province'`). Kiot cũ tự có giá trị này khi đưa lên web.
4. Toạ độ chính xác chỉ chủ Kiot và admin thấy. Nơi công khai chỉ hiện khoảng cách, hoặc điểm làm tròn khoảng 500m, trừ khi
   chủ Kiot bật "Hiện vị trí cửa hàng chính xác".

### V5.2 Hồ sơ nguồn gốc và huy hiệu (C16, C17, C42, M8) — công tắc `feature.origin`

1. Trang mới `/kiot-cua-toi/nguon-goc`. Hồ sơ gồm:
   - ít nhất 1 **hoá đơn gốc** hoặc **giấy chứng nhận xuất xứ** (ảnh JPG/PNG/WebP hoặc PDF ≤ 10MB);
   - ít nhất 3 **ảnh hàng thật** (tối đa 6);
   - **video quay hàng** ≤ 60 giây (không bắt buộc, đi qua bộ xử lý video);
   - tick 2 cam kết: "Hàng có nguồn gốc xuất xứ, không giả mạo, không lừa dối" và "Đồng ý hoàn tiền cho khách nếu 9MUA xác
     định là hàng giả".
2. File lưu ở thư mục riêng tư `PRIVATE_DIR` như ảnh CCCD; chỉ admin xem qua route có kiểm quyền. Không phục vụ công khai.
3. Trạng thái: `pending` → `approved` / `rejected` (kèm lý do, nộp lại được) → `revoked` (CEO thu hồi, kèm lý do).
   Hồ sơ có hạn **12 tháng**; nhắc gia hạn trước 30 ngày; hết hạn thì mất huy hiệu nguồn gốc.
4. **Huy hiệu** (hiện ở đầu trang Kiot, trang sản phẩm, thẻ Kiot ở Chợ và tìm kiếm):
   - "Đã xác thực nguồn gốc": hồ sơ `approved` còn hạn.
   - "Đã xác thực ngân hàng": KYC `approved` và tên tài khoản nhận tiền khớp tên CCCD (dữ liệu đang có ở `payouts`).
   - "Đã xác thực video": hồ sơ `approved` có video.
   - Mức màu theo số huy hiệu: 1 = **Xanh**, 2 = **Vàng**, 3 = **Tím**. CEO đổi tên và màu trong `/admin/noi-dung`.
5. Bảng `OriginDossier` (kiotId, status, commitAt, reviewedBy, reviewedAt, reason, expiresAt) và `OriginFile` (dossierId,
   kind `invoice | certificate | photo | video`, path, bytes).

### V5.3 Giao diện Kiot kéo thả, 50 mẫu (C27) — công tắc `feature.kiot_builder`

1. Trang `/kiot-cua-toi/giao-dien`. **50 mẫu = 10 bố cục × 5 bảng màu** có sẵn (bảng màu đều đạt độ tương phản chữ của
   `docs/BRAND.md`).
2. Khối có thể bật/tắt và kéo đổi thứ tự: Ảnh bìa, Giới thiệu, Sản phẩm nổi bật (chọn ≤ 8), Lưới sản phẩm, Video, Live,
   Đánh giá, Sự kiện, Liên hệ, Bản đồ, Mạng xã hội.
3. Kéo bằng chuột hoặc chạm giữ trên điện thoại; mỗi khối cũng có nút lên/xuống.
4. Xem trước khung điện thoại và máy tính; bấm "Lưu" mới áp dụng. Lưu vào `Kiot.layout` (JSON, kiểm tra cấu trúc ở máy chủ).
5. Kiot chưa từng chỉnh giữ đúng giao diện trang Kiot hiện nay.

### V5.4 Nhập Page từ mạng xã hội (C28) — công tắc `feature.page_import`

1. Ở `/ket-noi`, mỗi mạng (Facebook, Instagram, TikTok, YouTube, Zalo OA, Shopee) có nút "Kết nối" khi đã có khoá của mạng đó.
2. Kết nối xong thì kéo danh sách Page/kênh người dùng quản lý; tick chọn từng cái hoặc "Chọn tất cả"; bấm "Nhập".
3. Chỉ nhập: tên, ảnh đại diện, link, số người theo dõi (cập nhật mỗi ngày). **Không** kéo bài đăng hay video.
4. Page đã nhập hiện ở khối "Mạng xã hội" trên trang Kiot và trang cá nhân. Tài khoản chưa có Kiot nhập tối đa 1 Page.
5. Token lưu mã hoá; "Ngắt kết nối" xoá token và Page đã nhập. Mạng chưa có khoá: giữ cách gắn link tay như hiện nay.
6. Bảng `PageImport` (userId, network, externalId, name, avatarPath, url, followers, tokenEnc, updatedAt).

### V5.5 Bảo hành (C29) — công tắc `feature.kiot_builder`

- Cột `Product.warranty` (≤ 60 ký tự, ví dụ "Bảo hành 12 tháng tại Kiot") và `Kiot.warrantyDefault` điền sẵn cho sản phẩm mới.
- Hiện dưới giá trên trang sản phẩm (M7). Để trống thì không hiện.

### V5.6 Biến thể sản phẩm (C83) — công tắc `feature.variants`

1. Tối đa 2 nhóm tuỳ chọn (ví dụ Màu, Size), tối đa 50 biến thể mỗi sản phẩm.
2. Mỗi biến thể có giá, giá gốc (tuỳ chọn), tồn kho, ảnh (chọn từ ảnh sản phẩm), ẩn/hiện.
3. Sản phẩm có biến thể: giá hiện dạng thấp nhất – cao nhất; người mua phải chọn biến thể trước khi thêm vào giỏ.
4. Sản phẩm không có biến thể chạy y như hiện nay.
5. Giỏ và đơn: `CartItem.variantId` (khoá duy nhất thành userId, productId, variantId); `OrderItem.variantId` và
   `OrderItem.variantLabel` chụp lại lúc đặt. Giữ hàng và hoàn hàng theo từng biến thể, cùng cách khoá chống bán quá tồn kho.
6. Tắt công tắc: ẩn chỗ tạo biến thể mới; sản phẩm đã có biến thể vẫn bán bình thường.
7. Bảng `ProductVariant` (productId, option1, option2, price, compareAtPrice, stock, imageId, position, hidden).

### Hợp đồng mới của `kiot` (chỉ thêm)

```ts
setKiotLocation(kiotId, ownerId, { lat; lng } | 'province', showExact): Promise<Result>
kiotGeo(kiotIds): Promise<Map<kiotId, { lat; lng; approx: boolean }>>   // đã làm tròn khi cần
submitOriginDossier / reviewOriginDossier(adminId, dossierId, decision, reason) / revokeOrigin(adminId, kiotId, reason)
kiotBadges(kiotIds): Promise<Map<kiotId, Badge[]>>
saveKiotLayout(kiotId, ownerId, layout): Promise<Result>; kiotLayout(kiotId)
connectNetwork / listRemotePages / importPages / disconnectNetwork
upsertVariants(productId, ownerId, variants[]): Promise<Result>
decrementStock / tryDecrementStock / restoreStock nhận thêm variantId (tuỳ chọn) trong từng dòng
```

### Kiểm thử V5 (riêng `kiot`)

- File hồ sơ không mở được bằng đường công khai; admin mở được qua route có kiểm quyền.
- Huy hiệu đúng theo 3 điều kiện; hồ sơ hết hạn thì mất huy hiệu nguồn gốc.
- `layout` sai cấu trúc bị từ chối; Kiot chưa chỉnh hiện như cũ.
- Biến thể: 2 người cùng mua biến thể cuối cùng, 1 người thành công; mua biến thể A không trừ tồn kho biến thể B.
- Toạ độ chính xác không có trong HTML công khai khi chủ Kiot chưa bật hiện chính xác.
