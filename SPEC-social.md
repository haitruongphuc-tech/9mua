# Spec: `social` — Follow, bình luận, lưu, hashtag, giới hạn Free, voucher Kiot

> Module 12 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `kiot`, `billing`, `creator`.
> Nền móng chung theo `SPEC-identity.md`. Giao diện theo chuẩn V4 (`docs/BRAND.md`), đủ 7 thứ tiếng (`SPEC-i18n.md`).
> **Trạng thái: CEO duyệt qua chat ngày 27/10/2026** (câu 1 "làm luôn", câu 7 "b").

## Objective

Biến 9MUA thành mạng xã hội bán hàng như TikTok: người xem follow người bán, bình luận, lưu video, khám phá theo
hashtag, và có tab "Đang Follow". Tài khoản chưa có Kiot (tài khoản Free) dùng được mọi thứ nhưng có giới hạn mỗi
ngày; thả đủ tim thì được tặng voucher mở Kiot (V4).

### Tiêu chí chấp nhận

1. **Follow**
   - Follow một **tài khoản** (creator hoặc chủ Kiot). Nút Follow trên trang Kiot là follow chủ Kiot đó.
   - Bấm lần nữa để bỏ follow. Không follow chính mình.
   - Số Followers và Đang follow hiện trên trang creator, trang Kiot và trang Tôi.
   - Người mình follow đăng video mới (video `ready`) thì mình nhận thông báo trong app.
2. **Tab "Đang Follow" trên feed trang chủ** (cạnh "Dành cho bạn", như V4):
   - Video của những người mình follow, mới nhất trước.
   - Chưa đăng nhập thì bấm tab sẽ mở khung đăng nhập. Chưa follow ai thì hiện "Bạn chưa follow ai" và nút
     "Xem Dành cho bạn".
3. **Bình luận video**
   - Phải đăng nhập. Tối đa 300 ký tự. **Không cho gửi link** (chống lừa đảo, giống chat live).
   - Trả lời 1 cấp. Người đăng video ghim được 1 bình luận (hiện đầu tiên, có nhãn "Đã ghim") và ẩn được bình
     luận trên video của mình.
   - Báo cáo bình luận: **5 người khác nhau** báo cáo thì tự ẩn, chờ CEO xem trong hàng chờ Báo cáo.
   - Chống spam: mỗi người 1 bình luận mỗi 10 giây, tối đa 100 bình luận mỗi ngày.
   - Người đăng video nhận thông báo khi có bình luận; người được trả lời nhận thông báo khi có trả lời.
   - Số bình luận hiện trên nút bình luận của feed.
4. **Lưu (bookmark):** lưu video, bấm lần nữa để bỏ lưu. Trang Tôi có mục "Bộ sưu tập" xem lại video đã lưu.
5. **Hashtag**
   - Hashtag trong chú thích video bấm được, mở trang `/hashtag/<tag>`: lưới video có hashtag đó, xếp theo điểm feed.
   - Trang Chợ có hàng "Hashtag nổi bật": 10 hashtag có nhiều video `ready` nhất trong 7 ngày.
6. **Thả tim Kiot:** nút tim trên trang Kiot (V4). Số "Tim" của Kiot = tim Kiot + tổng lượt thích video của chủ Kiot.
7. **Giới hạn tài khoản Free** (tài khoản không có Kiot đang hoạt động, V4):
   - Tổng **tim (thích video, tim Kiot) + follow mới** tối đa **50 mỗi ngày** (giờ Việt Nam). Bỏ tim / bỏ follow
     không trả lại lượt.
   - Hết lượt thì báo "Tài khoản Free đã dùng hết 50 tim/follow hôm nay. Mở Kiot để không giới hạn." kèm nút mở Kiot.
   - Tim trong buổi live không tính vào giới hạn này.
   - Chủ Kiot đang hoạt động và admin không bị giới hạn.
   - Trang Tôi hiện "Đang dùng Free • n/50 tim/follow hôm nay".
8. **Voucher mở Kiot khi đủ 100 tim** (V4):
   - Đếm số **video khác nhau** mình đang thích, không tính video của chính mình. Đủ **100** thì được tặng
     **1 voucher**, giá trị bằng **1 năm phí Kiot**. Mỗi tài khoản nhận tối đa 1 voucher trong đời.
   - Chống tài khoản ảo: tài khoản phải tạo ít nhất **3 ngày**; tim từ tài khoản bị khoá không tính.
   - Nhận voucher thì có thông báo trong app. Dùng voucher ở bước kích hoạt / gia hạn Kiot (`SPEC-billing.md`).
   - CEO tắt/bật việc tặng voucher và đổi mốc 100 tim trong `/admin`; CEO thu hồi voucher **chưa dùng** kèm lý do.
9. **Mọi số đếm là thật**, không có số giả.

### Hợp đồng (`src/modules/social/index.ts`)

```ts
toggleFollow(followerId, followeeId): Promise<{ ok: true; following: boolean; followers: number } | { ok: false; error: 'SELF' | 'FREE_LIMIT' }>
followStats(userId, viewerId?): Promise<{ followers: number; following: number; isFollowing: boolean }>
followingFeed(userId, cursor?): Promise<Page<FeedVideo>>
listComments(videoId, viewerId?, cursor?): Promise<Page<CommentView>>
addComment(userId, videoId, text, parentId?): Promise<{ ok: true; comment: CommentView } | { ok: false; error: 'TOO_LONG' | 'HAS_LINK' | 'RATE_LIMIT' | 'DAILY_LIMIT' | 'NOT_FOUND' }>
pinComment(commentId, ownerId): Promise<Result>
hideComment(commentId, ownerId): Promise<Result>
reportComment(userId, commentId, reason): Promise<Result>
toggleSave(userId, videoId): Promise<{ saved: boolean }>
savedVideos(userId, cursor?): Promise<Page<FeedVideo>>
hashtagVideos(tag, cursor?): Promise<Page<FeedVideo>>
trendingHashtags(limit): Promise<{ tag: string; videos: number }[]>
toggleKiotHeart(userId, kiotId): Promise<{ ok: true; hearted: boolean; hearts: number } | { ok: false; error: 'FREE_LIMIT' }>
consumeDailyAction(userId, kind: 'heart' | 'follow'): Promise<{ ok: true } | { ok: false; error: 'FREE_LIMIT' }>  // creator.toggleLike gọi
freeStatus(userId): Promise<{ isFree: boolean; used: number; limit: number }>
checkVoucher(userId): Promise<void>               // gọi sau mỗi lần thích video
getVoucher(userId): Promise<VoucherView | null>
revokeVoucher(voucherId, adminId, reason): Promise<void>   // cho admin
```

### Dữ liệu (bảng mới, chỉ thêm)

- `Follow`: (followerId, followeeId) khoá chính, createdAt.
- `Comment`: id, videoId, userId, parentId?, text, pinnedAt?, hiddenAt?, hiddenBy?, reportCount, createdAt.
- `CommentReport`: (commentId, userId) khoá chính, reason.
- `SavedVideo`: (userId, videoId) khoá chính, createdAt.
- `KiotHeart`: (kiotId, userId) khoá chính, createdAt.
- `DailyAction`: (userId, day) khoá chính, count. Đếm tim + follow của tài khoản Free.
- `KiotVoucher`: id, userId (duy nhất), issuedAt, usedAt?, kiotId?, revokedAt?, revokedBy?, revokeReason?.
- Luật lưu trong `Setting`: `social.freeDailyLimit` (50), `social.voucherThreshold` (100), `social.voucherEnabled` (true).

## Testing Strategy

- **Unit:** phát hiện link trong bình luận (`http`, `www.`, `abc.com`, `zalo.me/…`); ngày theo giờ Việt Nam cho giới hạn.
- **Integration (DB thật):**
  - Follow/bỏ follow; không follow chính mình; feed Đang Follow chỉ có video của người đã follow.
  - Tài khoản Free: lượt thứ 51 trong ngày bị chặn; sang ngày mới dùng lại được; chủ Kiot không bị chặn.
  - Bình luận có link bị chặn; 2 bình luận trong 10 giây bị chặn; ghim chỉ người đăng video làm được; 5 báo cáo thì ẩn.
  - Voucher: 99 video → chưa có; 100 video → có 1 voucher và 1 thông báo; thích thêm không ra voucher thứ 2;
    tài khoản 2 ngày tuổi không nhận; tắt voucher trong admin thì không tặng.
- **E2E:** follow từ feed → tab Đang Follow có video đó; bình luận → người đăng thấy thông báo; lưu → Bộ sưu tập.

## Boundaries

- **Luôn làm:** kiểm tra quyền ở máy chủ (ghim/ẩn chỉ người đăng video); giới hạn tốc độ ở máy chủ.
- **Hỏi trước:** đổi voucher ra tiền; tặng voucher thứ 2.
- **Không bao giờ:** hiện số follower/tim/bình luận giả; cho bình luận chứa link.

## Bổ sung 29/10/2026

- Tin nhắn riêng giữa người dùng: CEO đã duyệt, xem `SPEC-messages.md`. `social` thêm hàm `followRelation(a, b)` cho module đó.

## Bổ sung 30/10/2026 — Đợt A: trang cá nhân, tìm kiếm, nút Đăng, thống kê creator

> **Trạng thái: chờ CEO duyệt.** CEO đã chốt qua chat 30/10:
> - làm theo đợt, bắt đầu Đợt A;
> - **cho phép thêm 3 cột trống vào bảng `User`**;
> - hàng "Creator nổi bật" để sau;
> - hoa hồng creator là Đợt E, có spec tiền riêng.
>
> Các đợt sau: B (bài chữ + ảnh, cảm xúc, đăng lại), C (chỉnh video, nhạc nền), D (nhóm), E (hoa hồng).
>
> **Cập nhật 30/10/2026:** CEO chốt làm hết trong một đợt (`docs/nang-cap-mot-dot.md`). Đợt A gộp vào đợt đó (mã C93).
> Đường dẫn trang cá nhân đổi theo C69: chính là `9mua.com/@<tên>`, link `/creator/<id>` chuyển hướng 301 sang đó.
> Trang Tìm kiếm thêm tab Kiot và tìm theo vị trí (`SPEC-marketplace.md` V5).

### A1. Nút "＋ Đăng" rõ ràng

- Trên feed Trang chủ `/` và `/video`, nút tròn "＋" nhỏ ở góc trên phải đổi thành nút **"＋ Đăng"** có chữ, màu cam,
  cao 36px, dẫn tới `/video/dang`.
- Chưa đăng nhập: bấm vào thì tới trang đăng nhập, xong quay về `/video/dang` (như hiện nay).

### A2. Trang cá nhân đầy đủ `/creator/<id>`

Giữ nguyên đường dẫn để link đã chia sẻ không hỏng.

- **Ảnh bìa** (tỉ lệ 3:1) và **ảnh đại diện** tròn. Chưa có ảnh đại diện thì hiện chữ cái đầu như nay; chưa có ảnh bìa
  thì hiện nền màu.
- **Giới thiệu** tối đa 160 ký tự, tối đa 4 dòng, **không cho link** (giống bình luận).
- Giữ các phần đang có: số người theo dõi, đang theo dõi, video, lượt thích, nút Theo dõi, Nhắn tin, link mạng xã hội.
- Bấm vào số **Người theo dõi** hoặc **Đang theo dõi** thì mở danh sách: ảnh, tên, bấm vào là tới trang cá nhân đó.
  - Mới theo dõi hiện trước; mỗi trang 30 người.
  - Không hiện tài khoản bị khoá.
- Chủ trang thấy nút **"Sửa hồ sơ"**, mở trang `/tai-khoan/ho-so`. Ở đó sửa được:
  - ảnh đại diện;
  - ảnh bìa;
  - tên hiển thị (cùng quy tắc tên hiện nay);
  - giới thiệu.

  Ảnh nào cũng xoá được.
- **Xử lý ảnh** (giống ảnh sản phẩm):
  - Nhận JPG, PNG, WebP tối đa 10MB, kiểm tra bằng nội dung file thật.
  - Xoay đúng chiều và bỏ hết thông tin ẩn trong ảnh (vị trí GPS…).
  - Ảnh đại diện cắt vuông ở giữa, lưu WebP 400×400. Ảnh bìa cắt 3:1, lưu WebP 1200×400.
  - Đổi ảnh mới thì xoá file ảnh cũ.
  - Mỗi người đổi ảnh tối đa 20 lần mỗi ngày.
- **Nơi hiện ảnh đại diện:**
  - trang cá nhân, nút tài khoản trên header, trang Tôi;
  - tên người đăng trên video;
  - bình luận;
  - Hộp thư (danh sách và phòng chat);
  - chủ phòng Live, hàng tròn Live/Story.

  Kiot vẫn dùng logo/chữ của Kiot như cũ.
- **CEO gỡ được** ảnh đại diện, ảnh bìa và giới thiệu vi phạm của một tài khoản:
  - làm trong trang `/admin` tra cứu tài khoản, phải ghi lý do;
  - có ghi audit log;
  - người dùng nhận thông báo.

### A3. Tìm kiếm `/tim-kiem?q=`

- Ô tìm trên header (máy tính) và nút kính lúp (điện thoại) chuyển tới `/tim-kiem` thay cho `/cho`. Trang Chợ vẫn giữ
  ô tìm sản phẩm riêng.
- Các tab:
  - **Tất cả:** 3 tài khoản, 6 video, 5 hashtag, 6 sản phẩm. Mỗi nhóm có nút "Xem thêm" mở tab của nhóm đó.
  - **Tài khoản**, **Video**, **Hashtag:** mỗi tab hiện tối đa 30 kết quả.
  - **Sản phẩm:** tối đa 30 kết quả, có thêm nút "Xem tất cả trong Chợ" (`/cho?q=`).
- Tìm **không cần dấu, không phân biệt hoa thường**. Ví dụ "thanh long" tìm ra "Thanh Long".
- Thứ tự kết quả:
  - **Tài khoản:** theo tên hiển thị. Tên bắt đầu bằng từ khoá xếp trước, sau đó người có nhiều người theo dõi xếp
    trước. Không hiện tài khoản bị khoá.
  - **Video:** tìm theo chú thích và hashtag. Chỉ video đang được hiện trên feed (đã đăng, không phải Story, tài khoản
    không bị khoá). Xếp theo điểm feed.
  - **Hashtag:** tìm theo tên, kèm số video, nhiều video xếp trước.
  - **Sản phẩm:** dùng đúng cách tìm của Chợ.
- Ô tìm trống thì hiện gợi ý: 10 hashtag nổi bật (đã có).
- Từ khoá tối đa 100 ký tự. Trang không bị Google lập chỉ mục (`noindex`).

### A4. Thống kê cho creator (đầu trang `/video/cua-toi`)

- Chọn **7 ngày** hoặc **30 ngày** (theo giờ Việt Nam). Tất cả là số thật, lấy từ dữ liệu đang có:
  - **Lượt xem:** mỗi người xem tính 1 lần mỗi ngày.
  - **Lượt thích mới.**
  - **Bình luận mới:** không tính bình luận đã bị ẩn.
  - **Người theo dõi mới:** số người đang theo dõi bắt đầu trong khoảng đó.
  - **Đơn hàng từ video:** đếm các đơn đã thanh toán có món được thêm từ video của mình. Không tính đơn huỷ, đơn đang
    hoàn tiền hoặc đã hoàn tiền.
  - **Doanh số từ video:** tổng tiền các món đó (giá × số lượng, số nguyên VNĐ). Ghi rõ: "Tiền hàng thuộc về Kiot bán
    hàng, không phải thu nhập của bạn."
- Mỗi video trong danh sách hiện thêm: số bình luận, số lượt lưu, doanh số (đã có lượt xem, thích, số đơn).
- Chỉ chủ video xem được số liệu của mình.

### Hợp đồng mới (thêm vào, không đổi hàm cũ)

- `identity`:
  - `updateProfile(userId, { displayName?, bio? })`: thêm trường `bio`, lỗi `BIO_TOO_LONG | HAS_LINK`.
  - `setProfileImage(userId, 'avatar' | 'cover', buffer)`.
  - `removeProfileImage(userId, kind)`.
  - `publicProfiles(ids)`: trả `{ id, displayName, avatarUrl }`, dùng khi hiện ảnh đại diện ở module khác.
  - `searchUsers(q, limit)`.
  - `clearProfileByAdmin(adminId, userId, reason)`.
- `social`:
  - `followList(userId, 'followers' | 'following', cursor?)`.
  - `searchHashtags(q, limit)`.
- `creator`:
  - `searchVideos(q, limit)`.
  - `creatorStats(userId, days: 7 | 30)`.
- `marketplace`: dùng lại `searchProducts`.

### Dữ liệu

- Bảng `User` thêm 3 cột, **có thể để trống**: `avatarUrl`, `coverUrl`, `bio`. Tài khoản cũ để trống, không đổi gì khác.
  CEO đã cho phép.
- Không thêm bảng mới. Không đụng tiền, đơn hàng hay đăng nhập.

### Kiểm thử

- **Unit test:**
  - giới thiệu có link hoặc quá dài bị từ chối;
  - ảnh giả (đổi đuôi) bị từ chối;
  - ảnh mới thay ảnh cũ và xoá file cũ;
  - tìm không dấu ra đúng kết quả, không lộ tài khoản bị khoá, không lộ video Story/chưa đăng;
  - số thống kê đúng với đơn đã thanh toán, đơn huỷ/hoàn tiền không tính;
  - danh sách theo dõi phân trang đúng.
- **E2E (điện thoại + máy tính):**
  - sửa hồ sơ (ảnh đại diện, bìa, giới thiệu) rồi thấy ảnh trên trang cá nhân và trên video;
  - tìm tài khoản, video, hashtag từ header;
  - xem thống kê 7/30 ngày;
  - nút "＋ Đăng" trên Trang chủ.

### Boundaries Đợt A

- **Không bao giờ:**
  - số liệu giả;
  - cho link trong phần giới thiệu;
  - hiện email hay số điện thoại trên trang cá nhân hoặc trong kết quả tìm kiếm;
  - giữ thông tin vị trí trong ảnh.

## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: chờ CEO duyệt.** Quyết định, công tắc, thư viện, dữ liệu: `docs/nang-cap-mot-dot.md`.

### V5.1 Bạn chung, gợi ý follow (C23, C24, M10) — công tắc `feature.social_more`

1. **Bạn chung (C23):** trên trang cá nhân của người khác: số người **mình đang follow** mà cũng follow trang này, 3 ảnh đại
   diện và 2 tên đầu. Bấm vào mở danh sách. Không tính tài khoản bị khoá hoặc đã chặn nhau.
2. **Gợi ý follow (C24):** tài khoản được những người mình follow đang follow, mà mình chưa follow.
   - Xếp theo số bạn chung, rồi số người theo dõi. Mình follow dưới 3 người thì lấy creator có nhiều lượt thích nhất 30 ngày.
   - Không gợi ý: chính mình, tài khoản bị khoá, đã chặn nhau, đã bấm "Ẩn" trong 30 ngày.
   - Hiện ở: cuối trang cá nhân, trang Tôi, và một hàng thẻ trong feed sau mỗi 15 video (chỉ khi đã đăng nhập).
   - Tính lại tối đa 1 lần mỗi giờ cho mỗi người.

### V5.2 Tab "Đã thích" (C62)

- Trang cá nhân có tab "Đã thích": video mình đã thả tim, mới nhất trước.
- Chủ trang luôn thấy. Người khác chỉ thấy khi chủ trang bật "Công khai video đã thích" (cột `User.showLikedVideos`,
  mặc định **tắt**).
- Chỉ hiện video người xem được phép xem (`canViewVideo`).

### V5.3 Chặn trên toàn web (C68)

1. Nút ⋯ trên trang cá nhân, bình luận, tin nhắn, buổi live → "Chặn". Bảng mới `UserBlock` (blockerId, blockedId, createdAt),
   khoá duy nhất. Chặn ở Hộp thư (`MessageBlock` đang có) cũng ghi vào `UserBlock`; khi đưa lên web, chép các dòng `MessageBlock`
   cũ sang `UserBlock` (chỉ thêm dòng).
2. Khi hai người chặn nhau (một chiều là đủ), **cả hai chiều**:
   - không thấy video, bài viết, bình luận, buổi live của nhau; trang cá nhân hiện "Không xem được trang này";
   - follow cũ giữa hai người bị gỡ; không follow lại được;
   - không bình luận, nhắc tên, nhắn tin, Duet, Stitch, dùng âm thanh của nhau;
   - người bị chặn vào buổi live của người chặn thì bị từ chối.
3. Chặn **không** chặn việc mua bán: đơn đang có vẫn xử lý và khiếu nại bình thường.
4. Danh sách chặn ở `/tai-khoan/cai-dat` (gộp danh sách chặn của Hộp thư), bỏ chặn được. Tối đa 1.000 người.

### V5.4 Bình luận: tim, nhắc tên, từ cấm (C25, C52, C67, M11)

1. **Tim bình luận (C25):** bấm tim, bấm lần nữa để bỏ. Bảng `CommentLike` (commentId, userId) khoá duy nhất; cột
   `Comment.likeCount`. Không tính vào giới hạn 50 tim/follow của tài khoản Free. Tối đa 60 lần mỗi phút.
   Thứ tự bình luận: ghim → từ 3 tim trở lên, nhiều tim trước → mới nhất.
2. **Nhắc tên @ (C52):** trong bình luận, chú thích video, chữ bài viết.
   - Gõ `@` hiện danh sách gợi ý (người mình follow trước, rồi tìm theo @tên và tên hiển thị).
   - `@tên` (C69) hiện thành link tới trang cá nhân. Tối đa 10 lần nhắc mỗi nội dung.
   - Bảng `Mention` (sourceType, sourceId, userId, createdAt). Người được nhắc nhận thông báo.
   - Cài đặt "Ai được nhắc tên tôi": Mọi người (mặc định) / Người tôi follow / Không ai. Không nhắc được người đã chặn nhau.
3. **Từ cấm (C67):** mỗi người lưu tối đa 50 từ, mỗi từ ≤ 30 ký tự (bảng `MutedKeyword`).
   - Bình luận trên video/bài của mình có từ đó (không phân biệt dấu, hoa thường, khớp nguyên từ) tự ẩn, `hiddenBy = 'keyword'`.
     Người viết vẫn thấy bình luận của mình.
   - Đầu bảng bình luận, chủ video thấy "Đã ẩn N bình luận chứa từ bạn chặn · Sửa từ cấm", mở ra xem và "Hiện lại" được.

### V5.5 Thông báo mới (C66)

- Loại mới: có người follow mình; có người thả tim/cảm xúc video hoặc bài; được nhắc tên; được trả lời bằng video; yêu cầu
  follow (tài khoản riêng tư); sự kiện sắp diễn ra; phim đã lưu có tập mới; bài được đăng lại.
- **Gộp:** follow mới và lượt thích của cùng một video gộp theo giờ: "Như Huỳnh và 4 người khác đã follow bạn".
  Mỗi video tối đa 1 thông báo thích mỗi giờ.
- Trang `/tai-khoan/cai-dat` mục "Thông báo": bật/tắt từng loại. Mặc định bật hết.

### V5.6 Điểm thưởng (C01, M1) — công tắc `feature.points`

1. **Chỉ để hiển thị.** Không đổi ra xu, tiền, voucher hay quà. CEO đổi ý thì phải có spec mới.
2. Luật mặc định (CEO chỉnh trong `/admin/cai-dat`):
   - +5 khi thả tim một video lần đầu (không tính video của mình).
   - +10 khi follow một người lần đầu.
   - +20 cho **cả hai** khi hai người follow nhau lần đầu.
   - Chuỗi ngày: ngày nào cũng thả tim ít nhất 1 video, từ ngày thứ 3 liên tiếp trở đi thì điểm tim của ngày đó nhân đôi.
3. Chống cày: tài khoản dưới 3 ngày không có điểm; tối đa 200 điểm mỗi ngày; bỏ tim hay bỏ follow rồi làm lại không có điểm
   lần nữa; điểm từ tài khoản bị khoá bị thu hồi bằng dòng trừ.
4. Sổ chỉ thêm `PointEntry` (userId, kind, points, refType, refId, vnDay, createdAt), khoá duy nhất (userId, kind, refId).
5. Hiển thị: hiệu ứng "+5 · chuỗi x2" bay lên cạnh nút tim (M1), "+10"/"+20" khi follow; tổng điểm trên trang Tôi.

### V5.7 Sự kiện và Kỷ niệm (C26) — công tắc `feature.events`

1. **Sự kiện:** chủ Kiot hoặc creator tạo ở `/su-kien/tao`.
   - Tên ≤ 80 ký tự, ảnh bìa, giờ bắt đầu và kết thúc, hình thức (Live trên 9MUA / Tại địa điểm), tỉnh + địa chỉ ≤ 120 ký tự,
     mô tả ≤ 1.000, gắn ≤ 6 sản phẩm.
   - Hình thức Live tự tạo kèm lịch live (`SPEC-live.md` V5.3).
   - Người xem bấm "Quan tâm": nhận thông báo 1 giờ trước giờ bắt đầu.
   - Trang `/su-kien` (sắp diễn ra, lọc theo tỉnh) và `/su-kien/<id>`; trang Kiot và trang cá nhân có khối Sự kiện.
   - Mỗi người tối đa 10 sự kiện sắp diễn ra. Báo cáo và CEO gỡ như video.
   - Bảng `Event`, `EventInterest`.
2. **Kỷ niệm "Ngày này năm trước":** trang Tôi hiện video hoặc bài của chính mình đăng cùng ngày tháng ở các năm trước.
   Chỉ chủ tài khoản thấy. Nút "Đăng lại" (V5.9). Tắt được trong Cài đặt.

### V5.8 Cảm xúc (C87) — công tắc `feature.posts`

- Chạm 2 lần vẫn là Thích như hiện nay. Giữ lâu nút tim mở 6 cảm xúc: Thích, Thương, Haha, Wow, Buồn, Giận.
- Mỗi người một cảm xúc cho mỗi video hoặc bài, đổi được. Số trên nút = tổng cảm xúc; bấm số xem từng loại.
- Dữ liệu: `VideoLike` thêm cột `reaction` (mặc định `like`, dòng cũ giữ `like`); bài viết dùng bảng `Reaction`.
- Giới hạn Free, voucher 100 tim, điểm thưởng tính mọi cảm xúc như một lượt tim.

### V5.9 Đăng lại (C88) — công tắc `feature.posts`

- Nút "Đăng lại" trong bảng chia sẻ của video hoặc bài `public` của người khác. Mỗi người đăng lại một nội dung tối đa 1 lần,
  bỏ đăng lại được.
- Nội dung đăng lại hiện trong tab Đang Follow của người follow mình, ghi "@tên đã đăng lại", và trong tab "Đăng lại" trên
  trang cá nhân. Chủ nội dung nhận thông báo.
- Bảng `Repost` (userId, videoId hoặc postId, createdAt).

### V5.10 Nhóm (C91) — công tắc `feature.groups`

1. Tạo nhóm ở `/nhom/tao`: tên ≤ 60 ký tự, ảnh, mô tả ≤ 500, loại **Công khai** hoặc **Riêng tư** (phải được duyệt mới vào,
   bài chỉ thành viên thấy). Tài khoản tạo từ 7 ngày mới được tạo nhóm; mỗi người tạo tối đa 5 nhóm.
2. Người tạo là quản trị; thêm tối đa 3 quản trị viên. Quản trị duyệt người vào (nhóm riêng tư), bật/tắt duyệt bài, xoá bài,
   cấm thành viên.
3. Thành viên đăng bài viết (V5.10 của `SPEC-creator`) hoặc video vào nhóm; thả cảm xúc, bình luận như thường.
4. Trang `/nhom` (nhóm của tôi, gợi ý nhóm công khai) và `/nhom/<id>`. Nhóm tối đa 10.000 thành viên.
5. Báo cáo nhóm hoặc bài trong nhóm vào hàng chờ CEO; CEO khoá nhóm kèm lý do.
6. Bảng `CommunityGroup`, `CommunityMember` (role, status), `CommunityPost` (groupId, videoId hoặc postId, status).

### Hợp đồng mới của `social` (chỉ thêm)

```ts
mutualFollowers(viewerId, profileId, limit): Promise<{ count; sample: PublicProfile[] }>
suggestedAccounts(viewerId, limit): Promise<PublicProfile[]>; hideSuggestion(viewerId, userId)
likedVideos(ownerId, viewerId, cursor?): Promise<Page<VideoThumb>>
blockUser(blockerId, blockedId); unblockUser; isBlockedEither(a, b): Promise<boolean>; listBlocked(userId)
toggleCommentLike(userId, commentId); parseMentions(text): string[]; recordMentions(source, text, authorId)
mutedKeywords(userId); setMutedKeywords(userId, words[]); applyKeywordFilter(commentId)
awardPoints(event); pointsTotal(userId)
createEvent / updateEvent / toggleEventInterest / upcomingEvents
setReaction(userId, target, reaction | null); reactionSummary(target)
toggleRepost(userId, target); repostsOf(userId, cursor?)
createGroup / joinGroup / approveMember / postToGroup / groupFeed / moderateGroupPost
```

`messages` đọc `isBlockedEither` thay cho bảng riêng; `creator`, `live` dùng nó để ẩn nội dung và từ chối thao tác.

### Kiểm thử V5 (riêng `social`)

- Bạn chung đúng giao của hai tập, bỏ tài khoản bị khoá; gợi ý không có người đã follow, đã chặn, đã ẩn.
- Chặn một chiều làm ẩn cả hai chiều ở feed, bình luận, live, nhắn tin, nhắc tên; đơn hàng cũ vẫn xử lý được.
- Từ cấm khớp không dấu và nguyên từ ("hàng" không khớp "hànghoá"); "Hiện lại" đưa bình luận về.
- Điểm: bỏ tim rồi tim lại không có điểm; tài khoản 2 ngày tuổi không có điểm; vượt 200 điểm/ngày bị chặn; chuỗi ngày thứ 3 nhân đôi.
- Gộp thông báo theo giờ đúng số người; tắt loại thông báo thì không gửi.
- Nhóm riêng tư: người ngoài không thấy bài; thành viên bị cấm không đăng được.
