# Spec: `creator` — Video dọc 9:16 có gắn sản phẩm

> Module 8 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `kiot`. Thêm vào giỏ qua `orders`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Mọi tài khoản đã đăng ký đều đăng được video dọc ngắn, gắn sản phẩm của các Kiot vào video. Người xem cuộn
feed như TikTok, bấm sản phẩm trên video là mua được ngay. Mục tiêu là đưa người xem tới Kiot và ghi nhận
đơn đến từ video nào, làm nền cho hoa hồng creator ở giai đoạn sau.

### Tiêu chí chấp nhận

1. **Đăng video** `/video/dang`:
   - Chọn file từ điện thoại: MP4, MOV (iPhone) hoặc WebM, **≤ 60 giây, ≤ 100MB**. Có thanh tiến trình tải lên.
   - Chú thích ≤ 300 ký tự. Hashtag `#thanhlong` được tách tự động.
   - Gắn **tối đa 3 sản phẩm**: tìm theo tên trong mọi Kiot đang hoạt động, mặc định ưu tiên sản phẩm
     của Kiot mình.
   - Mỗi tài khoản đăng tối đa **10 video/ngày**.
2. **Xử lý video** (máy chủ, chạy nền):
   - Trạng thái: tải lên xong là `processing`, sau đó `ready` hoặc `failed` (kèm lý do).
   - Worker dùng **ffmpeg** chuyển mọi video về **MP4 H.264 + AAC, tối đa 720×1280**, bật faststart
     (phát được ngay khi đang tải). Lý do: video quay bằng iPhone (HEVC/MOV) **không phát được** trên
     nhiều điện thoại Android và Chrome. Chuyển mã cũng giảm dung lượng 3–5 lần, đỡ băng thông VPS.
   - Tạo ảnh bìa từ giây thứ 1. Đo thời lượng thật, quá 60 giây thì `failed`.
   - Xoá metadata gốc (vị trí GPS).
   - Hàng đợi dùng bảng `VideoJob` trong Postgres (`FOR UPDATE SKIP LOCKED`). Worker là một tiến trình
     riêng `worker` trong docker-compose, cùng image với app, chạy 1 video một lúc để không làm chậm web.
   - Xử lý xong thì báo cho người đăng (thông báo trong app). Video `ready` mới lên feed.
3. **Feed `/video`**:
   - Toàn màn hình, vuốt lên/xuống chuyển video, tự phát (tắt tiếng sẵn, chạm để bật tiếng).
   - Tải trước video kế tiếp.
   - Trên video có: tên creator, chú thích, nút Thích, Chia sẻ, và **thẻ sản phẩm** (ảnh nhỏ, tên, giá).
     Bấm thẻ thì mở trang sản phẩm. Nút "Thêm vào giỏ" gọi `orders.addToCart(..., sourceVideoId)`.
   - Sản phẩm được gắn mà hết hàng, ẩn, hoặc Kiot không hoạt động thì thẻ tự ẩn. Video vẫn hiện.
   - Thứ tự feed: điểm = (lượt thích × 3 + lượt xem đủ ≥ 50% thời lượng) giảm dần theo tuổi video
     (chia `(giờ tuổi + 2)^1.5`), trộn 30% video mới nhất để video mới có cơ hội.
   - Người dùng đã đăng nhập không thấy lại video vừa xem trong 24 giờ.
4. **Lượt xem**: tính khi phát **≥ 3 giây**. Mỗi người xem (tài khoản, hoặc cookie ẩn danh) chỉ tính 1 lần
   mỗi video mỗi 24 giờ. Ghi theo lô để không làm chậm DB.
5. **Thích**: phải đăng nhập, bấm lần nữa để bỏ thích. Số đếm cập nhật ngay trên màn hình.
6. **Chia sẻ**: link `9mua.com/v/<id>` có thẻ Open Graph (ảnh bìa, chú thích), mở ra đúng video trong feed.
7. **Trang creator `/creator/<userId>`**: tên, số video, tổng lượt thích, lưới video.
8. **Thống kê của tôi `/video/cua-toi`**: mỗi video có lượt xem, lượt thích, **số đơn hoàn tất có nguồn
   từ video** (đếm `OrderItem.sourceVideoId`). Người đăng xoá được video của mình.
   *(Từ 30/10, theo `SPEC-social.md` A4 đã duyệt: đếm đơn **đã thanh toán**, trừ đơn huỷ / đang hoàn tiền / đã hoàn
   tiền, để số của từng video khớp với thống kê 7/30 ngày.)*
9. **Kiểm duyệt**:
   - Nút "Báo cáo" (lý do: nội dung xấu, lừa đảo, bản quyền, khác).
   - **5 người khác nhau** báo cáo thì video tự ẩn, chờ CEO xem.
   - CEO gỡ video kèm lý do, người đăng nhận thông báo.
   - Tài khoản bị khoá thì mọi video của tài khoản đó ẩn khỏi feed.
10. **Trang chủ**: `getHotVideos(8)` cấp cho khối "Video hot" của `marketplace`.

### Lưu trữ & phát

- File gốc xoá sau khi chuyển mã xong. Chỉ giữ bản 720p và ảnh bìa trong `UPLOAD_DIR/videos/`.
- Nginx phục vụ trực tiếp, hỗ trợ tua (HTTP Range), cache 1 năm.
- Nginx cấu hình `client_max_body_size 110m` cho riêng route tải video.
- Ghi file qua interface `MediaStore`, để sau này chuyển sang Cloudflare R2 hoặc Bunny Stream mà không
  sửa module. Đây là việc **nên làm khi lượt xem tăng**, vì băng thông VPS có hạn.

### Hợp đồng (`src/modules/creator/index.ts`)

```ts
createVideoUpload(userId, file, meta: { caption; productIds: string[] }): Promise<{ ok: true; videoId } | { ok: false; error: 'TOO_LARGE' | 'DAILY_LIMIT' | 'BAD_FORMAT' | 'PRODUCT_INVALID' }>
getFeed(viewer: { userId?; anonId }, cursor?): Promise<Page<FeedVideo>>
recordView(videoId, viewer, watchedSeconds): Promise<void>
toggleLike(videoId, userId): Promise<{ liked: boolean; likes: number }>
getHotVideos(limit): Promise<FeedVideo[]>
getCreatorProfile(userId): Promise<CreatorProfile>
myVideoStats(userId): Promise<VideoStat[]>
deleteVideo(videoId, userId): Promise<Result>
reportVideo(userId, videoId, reason, message): Promise<Result>
removeVideo(videoId, adminId, reason): Promise<void>     // cho admin
```

### Dữ liệu

- `Video`: id, authorId, caption, hashtags[], status (`processing | ready | failed | hidden | removed | deleted`),
  failReason, durationSec, width, height, fileUrl, posterUrl, views, likes, qualifiedViews, score, createdAt.
- `VideoProduct`: videoId, productId, position. Tối đa 3 dòng mỗi video.
- `VideoLike`: (videoId, userId) là khoá chính.
- `VideoView`: videoId, viewerKey, day. Khoá duy nhất cả ba cột.
- `VideoJob`: videoId, status, attempts, lockedAt, error.
- `VideoReport`: videoId, userId, reason, message. Khoá duy nhất (videoId, userId).

## Phụ thuộc mới (cần duyệt)

- **ffmpeg** (gói hệ điều hành, cài trong Docker image, không phải thư viện npm). Dùng qua `child_process`
  với danh sách tham số cố định, **không bao giờ ghép chuỗi lệnh từ dữ liệu người dùng**.
- Thêm service `worker` vào `docker-compose.yml` (cùng image với app).

## Testing Strategy (riêng module)

- **Unit:**
  - Tách hashtag.
  - Công thức điểm feed: video mới chưa có tương tác vẫn có điểm > 0, video cũ nhiều like giảm dần theo thời gian.
  - Luật tính lượt xem: dưới 3 giây không tính, trong 24 giờ không tính lại.
- **Integration** (dùng 3 video mẫu nhỏ trong `tests/fixtures`: MOV HEVC từ iPhone, MP4 ngang, file 75 giây):
  - MOV HEVC → `ready`, ra MP4 H.264 ≤ 720×1280 có ảnh bìa, không còn GPS.
  - File 75 giây → `failed` "Video dài hơn 60 giây".
  - File đổi đuôi `.mp4` nhưng không phải video → bị từ chối.
  - Hai worker chạy song song không xử lý trùng một video.
  - Thích 2 lần thì về 0. Không đăng nhập thì không thích được.
  - 5 báo cáo khác người thì ẩn video.
  - Gắn sản phẩm của Kiot không hoạt động thì `PRODUCT_INVALID`. Kiot hết hạn sau khi đăng thì thẻ sản phẩm tự ẩn.
  - Mua từ video → đơn hoàn tất → thống kê video tăng 1 đơn.
- **E2E (Playwright, thiết bị giả lập iPhone):** đăng video → chờ `ready` → mở `/video` → vuốt → bấm
  thẻ sản phẩm → thêm vào giỏ → trong giỏ có `sourceVideoId`.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Kiểm tra định dạng file thật bằng `ffprobe`, không tin đuôi file.
  - Giới hạn thời gian chạy ffmpeg (tối đa 5 phút mỗi video).
- **Hỏi trước:**
  - Bình luận.
  - Quà tặng, tiền thưởng, hoa hồng creator.
  - Livestream.
  - Chuyển lưu trữ video sang dịch vụ ngoài.
- **Không bao giờ:**
  - Phát video gốc chưa qua xử lý.
  - Hiện số lượt xem hoặc thích giả.
  - Ghép tên file hay dữ liệu người dùng vào câu lệnh shell.

## Success Criteria

- [ ] Video quay bằng iPhone đăng lên xem được trên Android, iPhone và Chrome máy tính.
- [ ] Video 60 giây xử lý xong dưới 1 phút trên VPS 2 vCPU.
- [ ] Vuốt sang video kế tiếp phát gần như ngay (đã tải trước).
- [ ] Mua hàng từ video được ghi nhận đúng video nguồn, và creator thấy trong thống kê.
- [ ] Đang xử lý video thì trang web vẫn nhanh bình thường (worker tách riêng).

## Quyết định đã chốt

1. Dùng ffmpeg chuyển mã video (service `worker` riêng).
2. Chưa có bình luận trong MVP.
3. Creator được gắn sản phẩm của mọi Kiot đang hoạt động.

## Bổ sung 27/10/2026 — Feed V4, Story 24h, Duet (CEO duyệt qua chat, câu 5 và 8 "làm luôn")

### Feed theo V4
- Tab "Đang Follow" / "Dành cho bạn" ở đầu feed (`SPEC-social.md` mục 2).
- **Thả tim 2 chạm**: chạm 2 lần lên video thì thích (không bỏ thích), túi cam + tim bay lên tại chỗ chạm.
- **Thanh tiến độ** 2px màu cam ở mép trên video, chạy theo thời gian phát.
- Cột nút bên phải (V4): ảnh người đăng có dấu ＋ để follow; tim (số thích); bình luận (số bình luận, mở bảng bình
  luận); lưu; chia sẻ; nút ⋯ (Duet, Báo cáo).
- Bên trái (V4): @tên, chú thích có hashtag bấm được, thẻ sản phẩm nền trắng có nút "+ Giỏ", hàng nút "Mở Kiot"
  (người chưa có Kiot) và "Duet".
- **Chia sẻ**: bảng trượt có Facebook, Messenger (điện thoại), sao chép link, chia sẻ của điện thoại (gồm Zalo), và
  **mã QR** của link.
  Không hiện nút của mạng không cho chia sẻ link (TikTok, Instagram, YouTube, Shopee).

### Story 24 giờ
- Ai đã đăng nhập cũng đăng được Story: video dọc **≤ 30 giây**, qua cùng bộ xử lý video (ffmpeg). Tối đa 10 Story/ngày.
- Story **tự ẩn sau 24 giờ** kể từ lúc xử lý xong. Không hiện trong feed chính.
- Hàng vòng tròn Story ở đầu trang Live (V4): mỗi người một vòng, viền cam khi có Story chưa xem, xám khi đã xem.
  Bấm vào xem toàn màn hình, có thanh tiến độ, hết Story tự sang người tiếp theo.
- Người đăng xoá được Story của mình. Báo cáo và gỡ Story giống video.
- Dữ liệu: thêm cột `kind` (`video | story`, mặc định `video`) và `expiresAt` (trống) vào bảng `Video`. Chỉ thêm cột,
  dữ liệu cũ không đổi.

### Duet
- Nút "Duet" trên video `ready` mở trang đăng video ở chế độ Duet: người dùng quay hoặc chọn video của mình (≤ 60 giây).
- Worker ghép **2 video cạnh nhau** thành một video dọc 720×1280: bên trái video gốc, bên phải video mới, mỗi bên cắt
  giữa khung. Tiếng: tiếng video mới + tiếng video gốc nhỏ hơn. Dài bằng video mới (video gốc lặp lại nếu ngắn hơn).
- Video Duet ghi "Duet với @tên" và link về video gốc; gắn sản phẩm như video thường (Collab bán chéo).
- Video gốc bị gỡ hoặc xoá thì không Duet được nữa; Duet đã đăng vẫn giữ.
- Dữ liệu: thêm cột `duetOfId` (trống) vào bảng `Video`.

### Kiểm thử bổ sung
- Story hết 24 giờ không còn trong danh sách; Story không lọt vào feed chính.
- Duet ra đúng 720×1280, có tiếng, dài bằng video mới; video gốc bị gỡ thì từ chối Duet.
- Chạm 2 lần thích đúng 1 lần (không bỏ thích); tài khoản Free hết lượt thì báo lỗi, không đổi số.

## Bổ sung 29/10/2026 — Trang chủ tổng hợp, menu Video và Live (CEO duyệt qua chat)

1. **Xem hết video thì chiếu lại.** Người đã đăng nhập vẫn không thấy lại video vừa xem trong 24 giờ. Nhưng nếu trang đầu
   của feed không đủ video chưa xem, thì lấy thêm các video đã xem (cùng thứ tự điểm) cho đủ. Trang chủ **không còn**
   chuyển sang khối Chợ khi người đã đăng nhập xem hết; khối Chợ chỉ hiện khi web chưa có video nào.
2. **Trang chủ `/`** gồm mọi thứ người dùng đăng:
   - Hàng tròn trên cùng: người **đang live** trước (viền đỏ, chữ LIVE, bấm vào xem live), sau đó Story 24 giờ và nút
     "+ Story".
   - Feed dọc tab "Dành cho bạn": video (cả Duet) và **buổi live đang phát** chèn vào: ở vị trí thứ 2, sau đó cứ 5 video
     chèn 1 buổi live, tới khi hết buổi live. Buổi live trong feed phát hình thật khi đang trên màn hình, giống trang Live
     (chat, tim, giỏ hàng). Tab "Đang Follow" giữ như cũ.
   - Chưa thêm bài đăng ảnh/chữ (để đợt sau).
3. **Menu Video `/video`**: chỉ video, cùng giao diện feed của trang chủ (có tab Đang Follow / Dành cho bạn, không che thanh
   dưới), không có hàng Story và không chèn live. Link chia sẻ `/v/<id>` giữ như cũ.
4. **Menu Live `/live`**: chỉ các buổi đang phát và nút Phát live; bỏ hàng Story khỏi trang Live.

## Bổ sung 30/10/2026 — Thống kê creator, tìm video, nút "＋ Đăng" (Đợt A)

Xem `SPEC-social.md` mục "Bổ sung 30/10/2026 — Đợt A" (A1, A3, A4). Hoa hồng creator vẫn ở mục "Hỏi trước"
(làm ở Đợt E, có spec riêng).

## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: CEO duyệt qua chat 30/10/2026 ("duyệt làm đi").** Quyết định, công tắc, dịch vụ ngoài, thư viện mới: `docs/nang-cap-mot-dot.md`.
> Mã C.. và hình M.. theo tài liệu "Đề xuất nâng cấp 9MUA". Mỗi mục dưới đây ẩn hẳn khi công tắc của nó tắt.

### V5.1 Video dài, nhiều mức chất lượng, ảnh bìa (C06, C07) — công tắc `feature.long_video`

1. **Giới hạn** (CEO chỉnh trong `/admin/cai-dat`):
   - Công tắc tắt: giữ như hiện nay, ≤ 60 giây, ≤ 100MB.
   - Công tắc bật: ≤ `video.long_max_seconds` (mặc định 3.600 giây) và ≤ `video.max_bytes` (mặc định 2GB).
   - Video dài hơn 60 giây chỉ cho tài khoản tạo từ **3 ngày** trở lên, không bị cấm đăng.
   - Story giữ ≤ 30 giây.
   - Mỗi ngày tối đa 10 video và **tổng 120 phút** video dài hơn 60 giây mỗi tài khoản.
2. **Định dạng nhận:** MP4, MOV, WebM, **AVI**. Kiểm tra bằng nội dung file (`ffprobe`), không tin đuôi file.
3. **Tải lên từng phần** (tự viết, không thêm thư viện):
   - `POST /api/uploads/video` mở phiên tải (tên, dung lượng, thời lượng đo ở trình duyệt). Trả mã phiên và kích thước phần
     **8MB**.
   - `PUT /api/uploads/video/<phiên>/parts/<n>` gửi từng phần. Gửi lại phần đã có thì bỏ qua, không lỗi.
   - `GET /api/uploads/video/<phiên>` trả danh sách phần đã nhận. Rớt mạng hoặc tải lại trang: trình duyệt hỏi danh sách rồi
     gửi tiếp phần còn thiếu (nhận ra cùng file nhờ tên + dung lượng + ngày sửa lưu trong `localStorage`).
   - Đủ phần thì máy chủ ghép, kiểm tra, xếp vào hàng chờ xử lý. Có thanh %, tốc độ và thời gian còn lại.
   - Phiên hết hạn sau 24 giờ, file tạm bị xoá. Mỗi người tối đa 3 phiên đang mở.
   - Nginx: giới hạn thân request 10MB cho đường tải phần (không mở 2GB cho một request).
   - Ổ đĩa VPS còn dưới 15% và chưa bật kho ngoài: từ chối mở phiên video dài, báo "Kho video tạm đầy, thử lại sau" và báo CEO.
4. **Hàng chờ xử lý:** `VideoJob` thêm cột `lane` (`short` | `long`). Worker luôn lấy việc `short` trước; việc `long` chạy khi
   không còn việc `short`, mỗi lúc 1 việc. Video dài xử lý quá 3 giờ thì `failed` kèm lý do.
5. **Bản lưu:**
   - Video ≤ 60 giây: như cũ (MP4 720p) **và thêm bản MP4 480p**.
   - Video > 60 giây: **HLS** (đoạn 6 giây), các mức 360p, 480p, 720p; thêm 1080p khi video gốc ≥ 1080p và CEO bật
     `video.enable_1080`. Tiếng AAC 128 kbps. File gốc xoá sau khi xử lý xong như hiện nay.
   - Bảng mới `VideoRendition`: videoId, kind (`mp4` | `hls`), height, path, bytes.
6. **Ảnh bìa:** máy chủ tạo 3 ảnh gợi ý ở 10%, 50%, 90% thời lượng. Người đăng chọn 1, hoặc tải ảnh riêng (JPG, PNG, WebP
   ≤ 10MB, cắt 9:16, bỏ thông tin ẩn như ảnh sản phẩm). Đổi ảnh bìa được sau khi đăng (V5.3).
7. **Ảnh xem trước động:** WebP động 3 giây, rộng 240px, lấy ở giữa video. Hiện khi di chuột hoặc giữ ngón tay trên ô video ở
   lưới (trang cá nhân, hashtag, tìm kiếm, Watch).
8. **Phát:** HLS phát sẵn trên Safari; Chrome/Android dùng `hls.js` (chỉ tải khi gặp video HLS). Video MP4 ≤ 60 giây: chọn bản
   480p khi trình duyệt báo mạng chậm hoặc bật tiết kiệm dữ liệu, còn lại 720p.
9. **Kho video ngoài** (`feature.external_storage`): `MediaStore` thêm driver `s3`. Bật thì file **mới** ghi lên kho ngoài và
   phát từ `STORAGE_PUBLIC_URL`; file cũ giữ trên VPS. Có lệnh `npm run media:migrate` để CEO chuyển dần file cũ, chạy lại được,
   không xoá bản trên VPS cho tới khi bản trên kho ngoài đọc lại khớp dung lượng.
10. **Trang CEO "Dung lượng"** (`/admin/dung-luong`): tổng GB video theo nơi lưu, ổ đĩa VPS còn trống, số video dài, ước tính GB
    tháng tới theo tốc độ 30 ngày qua.

### V5.2 Công cụ xem video (C57–C61, C63) — công tắc `feature.feed_tools`

1. **Thanh tua (C57):** mọi video có thanh tiến độ kéo được ở đáy video. Đang kéo thì hiện `phút:giây / tổng`. Thả tay thì phát
   tiếp từ đó. Chạm nhẹ vào thanh cũng tua tới chỗ chạm.
2. **Tốc độ phát (C58):** 0,5x · 1x · 1,5x · 2x, chọn trong nút ⋯. Nhớ lựa chọn trong `localStorage`. Live không có tốc độ.
3. **Xoay ngang (C59):** video quay ngang (rộng > cao) có nút "Toàn màn hình". Bấm thì mở toàn màn hình và xin xoay ngang;
   trình duyệt không cho xoay thì phóng video vừa màn hình ngang.
4. **Không quan tâm (C60):** trong nút ⋯. Bấm thì ẩn video đó ngay và sang video kế.
   - Bảng `VideoNotInterested` (người xem, videoId, ngày). Người chưa đăng nhập dùng mã ẩn danh như lượt xem.
   - Trong **30 ngày**, điểm feed của các video cùng người đăng với người xem đó nhân **0,2**.
   - Mỗi người giữ tối đa 500 dòng, dòng cũ nhất tự xoá.
5. **Lịch sử đã xem (C61):** trang `/tai-khoan/lich-su-xem`.
   - Video đã xem ≥ 3 giây trong 90 ngày, mới nhất trước, mỗi trang 30.
   - Xoá từng video hoặc xoá hết; tắt được việc ghi lịch sử.
   - Bảng `ViewHistory` (userId, videoId, lastViewedAt), khoá duy nhất (userId, videoId). Bảng `VideoView` dùng để đếm lượt
     xem giữ nguyên; xoá lịch sử không đổi số lượt xem.
6. **Tự cuộn (C63):** công tắc "Tự cuộn" cạnh thanh tua. Bật thì xem hết tự sang video kế; tắt thì lặp lại như hiện nay.
   Mặc định tắt, nhớ trong `localStorage`.

### V5.3 Tuỳ chọn khi đăng và sau khi đăng (C48–C50, C53–C56) — công tắc `feature.post_options`

1. **Nháp (C48):** nút "Lưu nháp" khi đăng. Video vẫn được xử lý nhưng ở trạng thái `draft`, không ai khác thấy.
   - Xem ở tab "Nháp" của `/video/cua-toi`. Mở lại để sửa và đăng.
   - Tối đa 20 nháp mỗi người. Nháp giữ 90 ngày rồi tự xoá; báo trước 7 ngày.
2. **Hẹn giờ đăng (C49):** chọn ngày giờ từ 15 phút tới 30 ngày sau (giờ Việt Nam). Trạng thái `scheduled`, cột `publishAt`.
   - Việc chạy mỗi phút đổi các video tới giờ sang `ready`. Khi đó mới gửi thông báo cho người follow.
   - Sửa giờ hoặc huỷ hẹn trước giờ đăng. Feed và trang cá nhân xếp theo `publishAt`.
3. **Quyền riêng tư từng video (C50):**
   - `visibility`: `public` (mọi người, mặc định) | `followers` (người đang follow) | `private` (chỉ mình tôi). Tài khoản riêng
     tư (`SPEC-identity` V5.2) mặc định `followers`.
   - `allowComments`, `allowRemix` (Duet và Stitch), `allowDownload`: mặc định bật.
   - Video không `public`: không vào feed Dành cho bạn, hashtag, tìm kiếm, khối Video hot, sitemap, mã nhúng; không Duet,
     Stitch, tải về. Link `/v/<id>` trả trang 404 cho người không được xem.
   - Hàm `canViewVideo(videoId, viewerId)` dùng chung cho mọi nơi hiện video, có test cho từng nơi.
4. **Địa điểm (C53):** chọn tỉnh/thành (34 tỉnh, mặc định tỉnh của Kiot nếu có) + tên địa điểm tự gõ ≤ 60 ký tự. Không lưu
   toạ độ GPS. Hiện dưới chú thích; dùng cho tìm kiếm video "Gần tôi" theo tỉnh (`SPEC-marketplace` V5.2).
5. **Ghim lên trang cá nhân (C54):** video của mình, nút ⋯ → "Ghim". Tối đa 3; ghim thứ 4 thì báo bỏ ghim một video trước.
   Video ghim đứng đầu lưới, có nhãn "Ghim".
6. **Nhãn AI (C55):** video làm từ AI Studio tự có `aiGenerated = true` và không gỡ được. Người đăng tự tick "Có dùng AI"
   cho video khác. Hiện chip "Nội dung tạo bằng AI" dưới tên người đăng.
7. **Sửa sau khi đăng (C56):** sửa chú thích, hashtag, sản phẩm gắn, quyền riêng tư, địa điểm, ảnh bìa, cho/không cho bình
   luận, Duet/Stitch, tải về. Không sửa file video. Video đã sửa hiện "Đã chỉnh sửa". Hashtag tính lại; chỉ người mới được
   nhắc tên mới nhận thông báo.

### V5.4 Phụ đề tự động (C51) — công tắc `feature.auto_captions`

1. Người đăng bật "Phụ đề tự động" khi đăng. Sau khi xử lý video, driver nghe giọng nói tạo phụ đề WebVTT.
   Nhà cung cấp đề xuất: **OpenAI Whisper** (`STT_PROVIDER=openai`, `OPENAI_API_KEY`), vì trả thẳng phụ đề có mốc thời gian, nhận
   tiếng Việt, giá khoảng 0,006 USD mỗi phút (cần kiểm lại trên trang giá OpenAI khi mở tài khoản). Driver tách riêng để đổi sang
   nhà cung cấp khác (Google, FPT.AI) mà không sửa module. Máy chủ tách tiếng ra file âm thanh nhỏ trước khi gửi.
2. Người đăng xem và sửa chữ phụ đề ở `/video/cua-toi` trước khi bật cho người xem.
3. Người xem có nút "CC" bật/tắt phụ đề, nhớ lựa chọn.
4. Chỉ video ≤ 10 phút. Ngân sách tháng `stt.monthly_budget_vnd`; hết ngân sách thì bỏ qua, báo người đăng và CEO.
5. Driver `fake` trả phụ đề mẫu cho dev/test. Chưa có khoá thì không bật được công tắc.

### V5.5 Quay trong app, hiệu ứng, làm đẹp, Stitch (C08, C09) — công tắc `feature.camera`

1. **Quay (C08)** ở `/video/dang`, dùng camera của trình duyệt (MediaRecorder):
   - Đổi camera trước/sau; đèn flash (chỉ hiện trên máy hỗ trợ); hẹn giờ 3 hoặc 10 giây.
   - Giữ nút để quay, thả để dừng; quay nhiều đoạn, xoá đoạn cuối; tổng độ dài theo giới hạn V5.1.
   - Tốc độ 0,5x · 1x · 2x · 3x áp cho đoạn đang quay; máy chủ đổi tốc độ khi xử lý (tiếng đổi theo, giữ cao độ).
   - Trình duyệt không cho dùng camera: chỉ còn nút chọn file như hiện nay.
2. **Hiệu ứng màu (C09):** 8 bộ lọc: Gốc, Sáng, Ấm, Lạnh, Cổ điển, Đen trắng, Rực, Mềm. Xem trước bằng bộ lọc của trình duyệt;
   máy chủ áp bộ lọc tương ứng của ffmpeg khi xử lý.
3. **Làm đẹp (C09):** mức 0–3: làm mịn da và sáng nhẹ toàn khung (ffmpeg). Không nhận diện hay chỉnh khuôn mặt. Đơn giản hơn
   TikTok; ghi rõ trong spec để không hứa quá.
4. **Stitch (C09):** trên video cho phép (`allowRemix`), nút ⋯ → "Stitch".
   - Chọn đoạn 1–5 giây của video gốc, rồi quay hoặc chọn video của mình.
   - Máy chủ ghép đoạn gốc + video mới thành một video 720×1280, ghi "Stitch với @tên" và link về video gốc.
   - Cột `stitchOfId`, `stitchFromSec`, `stitchToSec`. Video gốc bị gỡ hoặc tắt Stitch thì không Stitch được nữa; video đã
     Stitch vẫn giữ.

### V5.6 Chỉnh video và âm thanh (C89, C90) — công tắc `feature.camera`

1. **Chỉnh video (C89)** trước khi đăng, xem trước trên trình duyệt:
   - Cắt đầu, cắt cuối trên thanh thời gian.
   - Ghép tối đa 10 đoạn (quay hoặc chọn file), kéo để đổi thứ tự; tổng độ dài theo giới hạn V5.1.
   - Chữ trên video: tối đa 5 dòng, mỗi dòng ≤ 60 ký tự, 6 màu, kéo để đặt vị trí, chọn giây hiện và giây ẩn.
     Máy chủ vẽ bằng font Be Vietnam Pro.
   - Nhãn dán: 24 nhãn dán của 9MUA (Mua ngay, Giảm giá, Mới, Freeship, Hàng thật…), vị trí và thời gian như chữ.
   - Mọi chỉnh sửa lưu thành `editSpec` (JSON) trên `Video`; máy chủ dựng một lần khi xử lý.
2. **Âm thanh (C90)** — CEO chốt 30/10: **lấy từ âm thanh của video mọi người đăng lên**, như TikTok:
   - Mỗi video `public` có tiếng và cho phép `allowRemix` tự tạo một âm thanh gốc "Âm thanh gốc – @tên" (máy chủ tách tiếng khi
     xử lý video). Người đăng đặt lại tên âm thanh được.
   - "Dùng âm thanh này" trên video, hoặc tìm trong "Âm thanh" khi đăng: lấy tiếng đó làm nhạc nền cho video mới.
   - Mục "Âm thanh thịnh hành": 50 âm thanh được dùng nhiều nhất 7 ngày. Tìm âm thanh theo tên.
   - CEO vẫn tải nhạc lên được ở `/admin/am-thanh` (tên, nguồn, MP3/M4A ≤ 10MB, ≤ 5 phút) nếu muốn.
   - Khi đăng: chọn âm thanh, chọn đoạn bắt đầu, chỉnh âm lượng tiếng gốc và nhạc (0–100%).
   - Người đăng tắt `allowRemix` thì âm thanh của video đó không chọn mới được nữa; video đã dùng vẫn phát.
   - Trang `/am-thanh/<id>`: tên âm thanh, số video dùng, lưới video.
   - Bảng `Sound`: kind (`library` | `original`), title, artist, sourceVideoId, path, durationSec, status (`active` | `removed`).
     Cột `Video.soundId`. Âm thanh bị gỡ thì video đã đăng vẫn phát; không chọn mới được.

### V5.7 Chia sẻ thêm (C03–C05) — công tắc `feature.share_more`

1. **Tải về (C03):** video `public` và `allowDownload`, dài ≤ 10 phút.
   - Lần tải đầu tạo bản MP4 720p có logo 9MUA và @tên ở góc dưới (việc nền, hàng chờ `short`). Bản này giữ 7 ngày.
   - Mỗi người tối đa 20 lượt tải mỗi ngày. Chưa đăng nhập thì phải đăng nhập.
2. **Nhúng (C04):** trang `/nhung/<id>` chỉ có video, @tên và nút "Xem trên 9MUA". Chỉ video `public`.
   - Bảng chia sẻ có ô mã `<iframe>` và nút "Sao chép mã nhúng".
   - Riêng đường `/nhung/*` cho phép web khác nhúng (`frame-ancestors *`); mọi trang khác giữ chặn như cũ.
3. **TikTok, Instagram (C05):** hai nút sao chép link video rồi mở app đó trên điện thoại (máy tính mở trang web của mạng đó),
   kèm báo "Đã chép link, dán vào TikTok/Instagram". Thay quyết định cũ "không hiện nút của mạng không cho chia sẻ link".
4. Gửi qua Hộp thư (C65): `SPEC-messages.md` V5.1.

### V5.8 Trả lời bình luận bằng video (C64) — công tắc `feature.social_more`

1. Người đăng video có nút "Trả lời bằng video" dưới bình luận trên video của mình.
2. Mở trang đăng video với thẻ bình luận (ảnh, tên, nội dung) dán lên video, kéo để đặt vị trí.
3. Video mới có `replyToCommentId`. Dưới bình luận gốc hiện "Đã trả lời bằng video", bấm để mở. Người bình luận nhận thông báo.
4. Bình luận gốc bị ẩn hoặc xoá thì thẻ trên video ghi "Bình luận không còn".

### V5.9 Watch: phim ngắn nhiều tập (C02, M9) — công tắc `feature.watch`

1. **Tạo phim** ở `/video/cua-toi` → "Phim của tôi": tên ≤ 80 ký tự, mô tả ≤ 500, ảnh bìa 2:3, thể loại (Tình cảm, Hài, Gia đình,
   Hành động, Khác), trạng thái "Đang ra" hoặc "Đã đủ tập".
2. **Tập:** video thường gắn `seriesId` và `episodeNo` (1–200, không trùng). Gắn khi đăng hoặc sau khi đăng. Mỗi tập theo giới hạn
   độ dài V5.1.
3. **Trang `/watch`:** 3 hàng: Mới cập nhật, Xem nhiều 7 ngày, Phim đang theo dõi. Tab "Watch" trên feed trang chủ dẫn tới đây.
4. **Trang phim `/watch/<id>`:** trình phát, danh sách tập, đánh dấu tập đã xem (xem ≥ 90%).
   - Tự phát tập tiếp, mặc định bật, tắt được.
   - Nhớ tập và giây đang xem: đã đăng nhập lưu máy chủ, chưa đăng nhập lưu `localStorage`.
   - "Lưu phim": bảng `SeriesFollow`; có tập mới thì nhận thông báo. "Theo dõi" = follow người đăng.
   - Sản phẩm gắn trên tập hiện và mua như video thường.
5. **Bình luận theo phút:** bình luận gửi khi đang xem một tập lưu `atSecond`. Hiện nhãn `mm:ss`, bấm để tua tới đó.
6. Tập vẫn lên feed như video thường, trừ khi người đăng chọn "Chỉ hiện trong Watch".
7. Không có tặng quà.
8. Bảng `Series`: id, ownerId, title, description, coverPath, genre, status, episodeCount, createdAt, updatedAt.

### V5.10 Bài đăng ảnh + chữ (C86) — công tắc `feature.posts`

1. **Đăng bài** ở `/video/dang`, chế độ thứ ba "Bài viết" (nút ＋ Đăng mở thẳng được chế độ này):
   - **Viết bài:** chữ ≤ 2.000 ký tự, xuống dòng giữ nguyên, hashtag và @tên bấm được. Có ảnh hay không đều được.
   - **Đăng ảnh:** 0–10 ảnh (JPG, PNG, WebP ≤ 10MB mỗi ảnh, xử lý như ảnh sản phẩm), kéo để đổi thứ tự.
   - Bài phải có chữ hoặc ít nhất 1 ảnh. Bài chỉ có chữ và ≤ 300 ký tự được chọn 1 trong 6 nền màu, chữ to ở giữa.
   - Không cho link trong chữ (giống bình luận). Gắn ≤ 3 sản phẩm; nhạc nền tuỳ chọn (V5.6); quyền riêng tư như video (V5.3).
   - Sửa chữ, ảnh, sản phẩm sau khi đăng như video (V5.3 mục 7); lưu nháp và hẹn giờ đăng như video (V5.3 mục 1–2).
2. **Hiện ở:** feed trang chủ (chèn như video, ảnh vuốt ngang), tab "Bài viết" trên trang cá nhân, trang hashtag.
3. Thả cảm xúc, bình luận, lưu, chia sẻ, báo cáo, ghim như video. Mỗi người tối đa 20 bài mỗi ngày.
4. Bảng `Post` (id, authorId, text, bgColor, visibility, allowComments, soundId, status, createdAt) và `PostImage`. Bảng
   `Comment`, `SavedVideo`, báo cáo thêm cột `postId` (trống), mỗi dòng có đúng một trong `videoId` hoặc `postId`.

### V5.11 Đẩy video và live lên đầu bằng xu (C94) — công tắc `feature.xu_spend`

1. Video `public` đã đăng của mình: nút ⋯ → "Đẩy video". Giá mặc định **10 xu mỗi giờ** (CEO chỉnh trong `/admin/xu`),
   chọn 1–24 giờ.
2. Trong thời gian đẩy, video được chèn ở **vị trí thứ 3** trong feed Dành cho bạn của người chưa xem video đó, mỗi người xem
   tối đa 1 lần, có nhãn "Được đẩy". Toàn hệ thống tối đa 20 video được đẩy cùng lúc; đủ thì xếp hàng theo thời điểm trả.
3. Đang live: người phát bấm "Đẩy live", **10 xu mỗi 30 phút**; buổi live được chèn ở vị trí thứ 1 trong feed trang chủ.
4. Trừ xu bằng `XuEntry(kind = 'spend_boost', refId = mã lượt đẩy)`. Số dư xu không đủ hoặc đang âm thì không đẩy được.
5. Video bị gỡ, chuyển riêng tư hoặc buổi live kết thúc trước giờ: hoàn phần xu chưa dùng bằng `XuEntry(kind = 'boost_refund')`.
6. Người đăng xem số lượt hiển thị và lượt xem có được trong thời gian đẩy ở `/video/cua-toi`.
7. Bảng `Boost` (id, userId, videoId hoặc liveId, xu, startsAt, endsAt, impressions, status).

### Hợp đồng mới của `creator` (chỉ thêm)

```ts
openUploadSession(userId, { name, bytes, seconds, kind }): Promise<{ ok: true; sessionId; partSize } | { ok: false; error: 'TOO_LARGE' | 'TOO_LONG' | 'ACCOUNT_TOO_NEW' | 'DAILY_LIMIT' | 'STORAGE_FULL' | 'TOO_MANY_SESSIONS' }>
putUploadPart(sessionId, userId, index, bytes): Promise<Result>
uploadStatus(sessionId, userId): Promise<{ received: number[]; total: number }>
finalizeUpload(sessionId, userId, meta: PostMeta): Promise<{ ok: true; videoId } | { ok: false; error }>
updateVideoMeta(userId, videoId, patch: Partial<PostMeta>): Promise<Result>
schedulePublish(userId, videoId, at: Date | null): Promise<Result>
publishDueScheduled(now): Promise<number>
canViewVideo(videoId, viewerId | null): Promise<boolean>
pinOnProfile(userId, videoId, pinned: boolean): Promise<Result>
markNotInterested(viewerKey, videoId): Promise<void>
viewHistory(userId, cursor?): Promise<Page<VideoThumb>>; clearViewHistory(userId, videoId?): Promise<void>
requestDownload(userId, videoId): Promise<{ ok: true; url } | { ok: true; pending: true } | { ok: false; error }>
listSounds(q?): Promise<SoundView[]>; soundPage(soundId, cursor?): Promise<SoundPage>
createSeries / updateSeries / setEpisode / seriesPage / saveWatchProgress / toggleSeriesFollow
createPost(userId, input): Promise<Result>; updatePost; deletePost; canViewPost
```

### Kiểm thử V5 (riêng `creator`)

- Tải lên từng phần: mất phần giữa chừng rồi gửi tiếp vẫn ra file đúng; gửi trùng phần không hỏng file; phiên quá 24 giờ bị xoá;
  tài khoản dưới 3 ngày bị từ chối video > 60 giây; vượt 2GB hoặc 60 phút bị từ chối; ổ đầy thì từ chối.
- Hàng chờ: có việc `short` thì việc `long` không được lấy trước.
- Video > 60 giây ra HLS đủ các mức theo độ phân giải gốc; video ≤ 60 giây ra MP4 720p và 480p; 3 ảnh bìa đúng vị trí.
- `canViewVideo` đúng cho cả 3 mức riêng tư ở feed, hashtag, tìm kiếm, trang cá nhân, `/v/<id>`, nhúng, tải về, Duet, Stitch.
- Hẹn giờ: tới giờ mới lên feed và mới gửi thông báo; huỷ hẹn thì không đăng.
- Không quan tâm làm giảm điểm feed đúng 30 ngày; lịch sử xem xoá được mà lượt xem không đổi.
- Stitch ra 720×1280, có đoạn gốc đúng giây đã chọn; Watch đánh dấu tập đã xem ở 90%; bình luận theo phút tua đúng.
- Bài viết: không cho link; bài trống (không chữ, không ảnh) bị từ chối; 11 ảnh bị từ chối; bài chỉ chữ 2.000 ký tự đăng được;
  bài `private` không lên feed.

### Boundaries V5

- **Không bao giờ:** phát file chưa qua xử lý; cho xem video không `public` qua bất kỳ đường nào khi không đủ quyền; xoá bản trên
  VPS trước khi bản trên kho ngoài đọc lại khớp; tạo âm thanh dùng lại từ video không `public` hoặc đã tắt `allowRemix`.
- **Hỏi trước:** bật 1080p; tăng giới hạn tổng phút mỗi ngày; cho Story dài hơn 30 giây.
