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
