# Nâng cấp một đợt (30/10/2026)

> **Trạng thái: chờ CEO duyệt.** Tài liệu chung cho đợt nâng cấp lớn sau khi so 3 bản thiết kế (V4.1, V4.3, V4.7) và TikTok
> với 9mua.com bản `main` ngày 30/10/2026. Danh sách chức năng C01–C85 và hình các màn hình M1–M14 nằm trong tài liệu
> "Đề xuất nâng cấp 9MUA" (Claude Docs). File này ghi quyết định, bảng tra mã → spec, công tắc, dịch vụ ngoài, thư viện mới,
> thay đổi dữ liệu và cách đưa lên web. Hành vi chi tiết của từng chức năng nằm trong các `SPEC-<module>.md`, mục
> "Bổ sung 30/10/2026 — Nâng cấp một đợt".

## 1. Quyết định của CEO (30/10/2026, qua chat)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Chia đợt | **Làm hết trong một đợt**, không chia Đợt A–F. Trừ phần App (C32–C36: hộp mời tải app, lối tắt, màn hình mở app, xem khi mất mạng, thông báo đẩy) để sau. |
| 2 | Đưa lên web | Một lần. Mỗi nhóm chức năng có công tắc trong Admin. Phần đụng tiền và phần chờ khoá dịch vụ để **tắt sẵn**. |
| 3 | Video dài | **Làm luôn 60 phút, 2GB**, kèm kho video ngoài (khoá điền sau). |
| 4 | Thư viện mới, thêm cột vào bảng đang có dữ liệu | Đồng ý. **Chỉ thêm cột/bảng**, không xoá hay sửa dữ liệu cũ. |
| 5 | Vui chơi có tiền, GHN/GHTK, thanh toán khi nhận hàng, trả chi phí tự động | **Làm luôn**, tắt sẵn. Trả chi phí tự động đi qua kênh chi hộ PayOS, chỉ trả cho người nhận CEO đã duyệt, có mức trần và ngân sách. |
| 6 | AI kiểm duyệt | **Viết sẵn, chưa kích hoạt.** CEO điền khoá sau. Dùng lại Claude như AI Studio. |
| 7 | Ai được đăng video dài hơn 60 giây | Tài khoản tạo từ **3 ngày** trở lên. |
| 8 | Điểm thưởng (C01) | **Đổi ra xu.** Tỉ lệ, mức trần và ngân sách do CEO chỉnh (mặc định ở `SPEC-social.md` V5.6). Phần đổi xu tắt sẵn. |
| 9 | Xử lý vi phạm 3 lần (C21) | **Dùng thêm**, giữ luật "5 người báo cáo thì tự ẩn". |
| 10 | "Làm hết" gồm những gì | **Tất cả, trừ App trên điện thoại.** Gồm cả các đợt đã lên kế hoạch: B (bài ảnh + chữ, cảm xúc, đăng lại), C (chỉnh video, nhạc nền), D (Nhóm), E (hoa hồng creator) = C86–C92, và **dùng xu** (gia hạn Kiot, đẩy video/live) = C94. Đợt A đã làm xong trên `main` (T74–T78, mã C93). |
| 11 | Phụ đề tự động | CEO giao Claude chọn. Claude đề xuất **OpenAI Whisper** (mục 4). |
| 12 | Nhạc nền | **Lấy từ âm thanh của video mọi người đăng lên** ("dùng âm thanh này" như TikTok). CEO vẫn tải nhạc lên được nếu muốn. |

## 2. Bảng tra mã → spec

| Mã | Chức năng | Spec |
|---|---|---|
| C01 | Điểm thưởng, đổi điểm ra xu | SPEC-social §V5.6 |
| C02 | Watch: phim ngắn nhiều tập | SPEC-creator §V5.9 |
| C03–C05, C65 | Tải về, nhúng, TikTok/Instagram, gửi qua Hộp thư | SPEC-creator §V5.7, SPEC-messages §V5.1 |
| C06, C07 | Video dài 60 phút / 2GB, nhiều mức chất lượng, 3 ảnh bìa, ảnh xem trước | SPEC-creator §V5.1 |
| C08, C09 | Quay trong app, hiệu ứng, làm đẹp, Stitch | SPEC-creator §V5.5 |
| C10, C11 | Cam kết nội dung | SPEC-identity §V5.6 |
| C12–C14, C38, C74 | Tìm Kiot theo tên, gần tôi, bản đồ nhiệt, micro, gợi ý từ khoá | SPEC-marketplace §V5.1–V5.4 |
| C15, C82 | Chấm sao Kiot, đánh giá sản phẩm | SPEC-orders §V5.1 |
| C16, C17, C42 | Hồ sơ nguồn gốc, huy hiệu, CEO duyệt | SPEC-kiot §V5.2 |
| C18 | Tố cáo hàng giả, xử lý 24 giờ | SPEC-orders §V5.2 |
| C19–C22 | AI kiểm duyệt, lý do báo cáo mới, xử lý 3 lần, trang Kiểm duyệt | SPEC-admin §V5.1–V5.4 |
| C23, C24, C62, C68 | Bạn chung, gợi ý follow, tab Đã thích, chặn toàn web | SPEC-social §V5.1–V5.3 |
| C25, C52, C64, C67 | Tim bình luận, @nhắc tên, trả lời bằng video, từ cấm | SPEC-social §V5.4, SPEC-creator §V5.8 |
| C26 | Sự kiện, Kỷ niệm | SPEC-social §V5.7 |
| C27–C29 | Kiot kéo thả 50 mẫu, nhập Page, bảo hành | SPEC-kiot §V5.3–V5.5 |
| C30 | Vui chơi có tiền | SPEC-play (module mới) |
| C94 | Dùng xu: gia hạn Kiot, đẩy video/live lên đầu | SPEC-billing §V5.1, SPEC-creator §V5.11 |
| C31, C85 | GHN/GHTK, thanh toán khi nhận hàng | SPEC-orders §V5.4–V5.5, SPEC-payouts §V5.1 |
| C32–C36 | App | **Để sau** |
| C37, C39–C41 | Nhãn "Cổng thế giới đã mở", Hướng dẫn, slogan trang mới, Pháp lý thêm STK và con dấu | SPEC-admin §V5.4 |
| C43–C47 | Kanban, chi phí, trả tự động, số dư qua CAS, tài chính, MISA | SPEC-admin §V5.5–V5.8 |
| C48–C51, C53–C56 | Nháp, hẹn giờ, quyền riêng tư, phụ đề, địa điểm, ghim, nhãn AI, sửa sau khi đăng | SPEC-creator §V5.3–V5.4 |
| C57–C61, C63 | Tua, tốc độ, xoay ngang, Không quan tâm, lịch sử đã xem, tự cuộn | SPEC-creator §V5.2 |
| C66 | Thông báo follow mới, thích, nhắc tên | SPEC-social §V5.5 |
| C69–C73 | @tên, tài khoản riêng tư, tự xoá, Apple, nhiều tài khoản | SPEC-identity §V5.1–V5.5 |
| C75–C79 | Live: giới hạn, xem lại, hẹn lịch, mời khách, người quản lý chat | SPEC-live §V5.1–V5.5 |
| C80, C81 | Nhắn nhóm, tin thoại, video, thu hồi | SPEC-messages §V5.2–V5.3 |
| C83, C84 | Biến thể, mã giảm giá, giảm giá theo giờ | SPEC-kiot §V5.6, SPEC-orders §V5.3 |
| C86 | Bài đăng ảnh + chữ (Đợt B cũ) | SPEC-creator §V5.10 |
| C87 | Cảm xúc: Thích, Thương, Haha, Wow, Buồn, Giận (Đợt B cũ) | SPEC-social §V5.8 |
| C88 | Đăng lại (Đợt B cũ) | SPEC-social §V5.9 |
| C89 | Chỉnh video: cắt, ghép nhiều đoạn, chữ và nhãn dán (Đợt C cũ) | SPEC-creator §V5.6 |
| C90 | Âm thanh: nhạc nền từ thư viện 9MUA, "dùng âm thanh này" (Đợt C cũ) | SPEC-creator §V5.6 |
| C91 | Nhóm (Đợt D cũ) | SPEC-social §V5.10 |
| C92 | Hoa hồng creator khi bán hộ (Đợt E cũ) | SPEC-payouts §V5.2 |
| C93 | Đợt A: trang cá nhân, tìm kiếm chung, nút ＋ Đăng, thống kê creator | **Đã xong** (T74–T78). Đợt này chỉ đổi đường dẫn theo C69 và thêm tab Kiot |

## 3. Công tắc chức năng

Bảng `Setting` thêm các khoá `feature.<tên>` (`on` | `off`). CEO bật/tắt ở trang mới `/admin/cong-tac`, mỗi lần đổi ghi audit log.
Công tắc tắt thì nút, trang và API của nhóm đó ẩn hẳn (API trả 404), dữ liệu đã có giữ nguyên.

| Công tắc | Mã | Mặc định | Lý do tắt sẵn |
|---|---|---|---|
| `feature.feed_tools` | C57–C61, C63 | bật | |
| `feature.share_more` | C03–C05, C65 | bật | |
| `feature.post_options` | C48–C50, C52–C56 | bật | |
| `feature.camera` | C08, C09, C89, C90 | bật | |
| `feature.long_video` | C06, C07 (> 60 giây, nhiều mức chất lượng) | **tắt** | Cần kho video ngoài và đo thời gian xử lý trên VPS |
| `feature.external_storage` | kho video ngoài | **tắt** | Chờ khoá |
| `feature.auto_captions` | C51 | **tắt** | Chờ khoá dịch vụ nghe giọng nói |
| `feature.watch` | C02 | bật | |
| `feature.posts` | C86, C87, C88 | bật | |
| `feature.groups` | C91 | bật | |
| `feature.points` | C01 (cộng điểm, hiển thị) | bật | |
| `feature.points_exchange` | C01 (đổi điểm ra xu) | **tắt** | Xu dùng thay tiền trong 9MUA |
| `feature.xu_spend` | C94 | **tắt** | Xu thay tiền phí Kiot, giảm doanh thu tiền mặt |
| `feature.social_more` | C23–C25, C62, C64, C66–C68 | bật | |
| `feature.events` | C26 | bật | |
| `feature.commitment` | C10, C11 | bật | |
| `feature.search_more` | C12, C13, C38, C74 | bật | |
| `feature.map` | C14 | **tắt** | Chờ khoá bản đồ |
| `feature.reviews` | C15, C82 | bật | |
| `feature.origin` | C16, C17, C42 | bật | |
| `feature.fake_report` | C18 | bật (báo cáo, xử lý) | |
| `feature.fake_report_refund` | C18 (hoàn tiền) | **tắt** | Đụng tiền |
| `feature.ai_moderation` | C19 | **tắt** | Chờ khoá |
| `feature.strikes` | C20–C22 | bật | |
| `feature.kiot_builder` | C27, C29 | bật | |
| `feature.page_import` | C28 | **tắt** | Chờ khoá từng mạng |
| `feature.variants` | C83 | **tắt** | Đổi tồn kho, giỏ hàng, đơn hàng |
| `feature.coupons` | C84 | **tắt** | Đổi số tiền đơn |
| `feature.carriers` | C31 | **tắt** | Đụng phí ship, chờ khoá |
| `feature.cod` | C85 | **tắt** | Đụng tiền |
| `feature.play` | C30 | **tắt** | Đụng tiền |
| `feature.commission` | C92 | **tắt** | Đụng tiền |
| `feature.live_more` | C77, C79 | bật | |
| `feature.live_recording` | C76 | **tắt** | Tốn ổ đĩa |
| `feature.live_guest` | C78 | **tắt** | Gấp đôi băng thông |
| `feature.messages_more` | C80, C81 | bật | |
| `feature.account_more` | C69–C71, C73 | bật | |
| `feature.apple_login` | C72 | **tắt** (tự ẩn khi chưa có khoá) | Chờ khoá |
| `feature.site_more` | C37, C39–C41 | bật | |
| `feature.ceo_finance` | C43, C44, C47 | bật | Chỉ admin thấy |
| `feature.expense_autopay` | C45 | **tắt** | Chuyển tiền công ty |
| `feature.bank_feed` | C46 | **tắt** | Chờ khoá CAS |

Giới hạn Live (C75) là số chỉnh trong Admin, không phải công tắc: mặc định giữ 2 buổi × 50 người.

## 4. Dịch vụ ngoài (viết sẵn, khoá điền sau)

Mỗi dịch vụ có driver `fake` cho dev/test, như PayOS và AI Studio. Thiếu khoá thì công tắc không bật được và Admin ghi
"Chưa có khoá".

| Dịch vụ | Dùng cho | Biến môi trường | CEO cần làm |
|---|---|---|---|
| Cloudflare R2 (hoặc dịch vụ cùng chuẩn S3) | Kho video ngoài | `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`, `STORAGE_S3_KEY`, `STORAGE_S3_SECRET`, `STORAGE_PUBLIC_URL` | Mở tài khoản, tạo bucket, gắn tên miền `media.9mua.com` |
| Claude (Anthropic) | AI kiểm duyệt | `ANTHROPIC_API_KEY` (đã có cho AI Studio), `MODERATION_MONTHLY_BUDGET_VND` | Đặt ngân sách tháng |
| OpenAI Whisper (đề xuất) | Phụ đề tự động | `STT_PROVIDER=openai`, `OPENAI_API_KEY` | Mở tài khoản OpenAI API, nạp tiền trả trước |
| Dịch vụ bản đồ (MapTiler hoặc Goong) | Bản đồ nhiệt, ghim vị trí Kiot | `MAP_TILE_URL`, `MAP_API_KEY` | Mở tài khoản |
| GHN, GHTK | Giao hàng, thu hộ COD | `GHN_TOKEN`, `GHN_SHOP_ID`, `GHTK_TOKEN` | Ký hợp đồng tài khoản doanh nghiệp 9MUA CO.,LTD |
| Casso ("CAS" trong bản V4.7) | Số dư, biến động tài khoản MBBank công ty | `CASSO_API_KEY`, `CASSO_WEBHOOK_SECRET` | Mở tài khoản Casso, liên kết tài khoản MBBank doanh nghiệp, tạo khoá và webhook |
| Apple | Đăng nhập bằng Apple | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Tài khoản Apple Developer (99 USD/năm) |
| Facebook, YouTube, TikTok, Zalo OA, Instagram, Shopee | Nhập Page | `PAGEIMPORT_<MẠNG>_*` | Xin duyệt ứng dụng với từng mạng |
| PayOS chi hộ | Trả chi phí tự động, rút tiền thưởng, hoa hồng | đã có `PAYOS_PAYOUT_*` | Nạp tiền vào tài khoản chi hộ |

## 5. Thư viện mới (CEO đã đồng ý 30/10)

| Gói | Dùng cho | Ghi chú |
|---|---|---|
| `leaflet` | Bản đồ (C13, C14, ghim vị trí Kiot) | Chỉ tải ở trang có bản đồ |
| `hls.js` | Phát video nhiều mức chất lượng trên Chrome/Android (C07) | Safari phát HLS sẵn |
| `@aws-sdk/client-s3` | Kho video ngoài | Chỉ chạy phía máy chủ |

Không thêm thư viện cho: tải lên từng phần (tự viết), quay video (MediaRecorder của trình duyệt), micro (Web Speech API),
kéo thả (sự kiện chạm/chuột), hiệu ứng video (ffmpeg đã có), biểu đồ (SVG tự vẽ như `LineChart`).

## 6. Thay đổi dữ liệu

Chỉ thêm. Cột mới trên bảng đang có dữ liệu đều **cho phép trống hoặc có giá trị mặc định**, nên bản ghi cũ không phải sửa.

- **Thêm cột:** `User` (handle, isPrivate, showLikedVideos, deleteRequestedAt, deletedAt + 3 cột Đợt A), `Kiot` (lat, lng,
  geoSource, showExactLocation, layout, codEnabled, carrier, warrantyDefault), `Follow` (status), `VideoLike` (reaction),
  `VideoJob` (lane), `SavedVideo` (postId), `CartItem` (variantId), `Conversation` (kind, title, avatarPath),
  `KycSubmission` (userId cho người không có Kiot), `Video` (visibility, allowComments, allowRemix, allowDownload,
  publishAt, placeProvince, placeName, aiGenerated, pinnedAt, renditions, previewPath, captionsPath, stitchOfId,
  stitchFromSec, stitchToSec, replyToCommentId, seriesId, episodeNo, soundId, editSpec; giá trị `status` thêm `draft`,
  `scheduled`), `Product` (warranty, ratingAvg, ratingCount, weightGram, lengthCm, widthCm, heightCm, commissionRate), `OrderItem`
  (variantId, variantLabel), `Order` (paymentMethod, couponId, discountVnd, shippingPaidBy, codFeeVnd, shipmentId),
  `Comment` (postId, atSecond, likeCount, replyVideoId), `LiveSession` (scheduleId, guestUserId,
  recordingVideoId), `XuEntry` (refId; khoá duy nhất `(kind, refId)` cho các loại dòng mới), `KiotSubscription` (cách trả `xu`).
- **Bảng mới** (định nghĩa ở spec từng module): ViewHistory, VideoNotInterested, VideoRendition, Series, SeriesFollow,
  Sound, Post, PostImage, Reaction, Repost, CommentLike, Mention, UserBlock, MutedKeyword, PointEntry, Event, EventInterest,
  CommunityGroup, CommunityMember, CommunityPost, CommitmentVersion, Commitment, SearchLog, ProductReview, ReviewMedia,
  ReviewReport, OriginDossier, OriginFile, FakeReport, ModerationCheck, Strike, KanbanCard, Expense, ExpensePayee,
  ExpensePayment, BankTransaction, ProductVariant, Coupon, CouponRedemption, FlashSale, Shipment, ShipmentEvent,
  CodRemittance, EarningEntry, LiveSchedule, LiveReminder, LiveModerator, Boost,
  MessageMedia, PageImport, PlayGame, PlayTurn, LeaderboardWeek.
- **Sổ chỉ thêm** (không sửa, không xoá; sửa sai bằng dòng bù): PointEntry, Commitment, Strike, ExpensePayment,
  BankTransaction, CouponRedemption, CodRemittance, EarningEntry, ShipmentEvent, cùng các sổ tiền đang có.

## 7. Cách làm và đưa lên web

1. CEO duyệt bộ spec này một lần.
2. Claude viết `tasks/plan.md` và `tasks/todo.md` cho đợt (T79 trở đi), rồi code một mạch trên nhánh `nang-cap-mot-dot`.
   Mỗi task: test trước → code → `npm run lint && npm test` → một commit. Đẩy lên GitHub sau mỗi task.
3. Review toàn bộ, chạy e2e trên điện thoại và máy tính.
4. CEO đưa lên web một lần bằng `scripts/deploy.sh`. Database chỉ thêm bảng và cột.
5. CEO bật từng công tắc tắt sẵn sau khi thử; điền khoá dịch vụ khi có.

## 8. Rủi ro đã báo CEO

- Đưa gần 90 chức năng lên cùng lúc: lỗi khó khoanh vùng. Giảm bằng công tắc từng nhóm và test cho từng chức năng.
- Video 60 phút: ổ đĩa, băng thông, thời gian xử lý trên VPS 2 nhân. Video dài có hàng chờ riêng, video ≤ 60 giây luôn đi trước.
- Live tăng giới hạn, ghi hình, mời khách: tốn băng thông và ổ đĩa; giữ giới hạn cũ tới khi CEO nâng máy.
- Các phần đụng tiền tắt sẵn, mỗi phần có sổ chỉ thêm, mức trần và nhật ký CEO.
- Nhạc nền (C90): âm thanh lấy từ video người dùng đăng lên. Người đăng tắt được việc cho người khác dùng âm thanh của mình;
  CEO gỡ được một âm thanh (video đã đăng vẫn phát, không ai chọn mới được); có lý do báo cáo "Vi phạm bản quyền".
- Đổi điểm ra xu (C01) và dùng xu (C94): xu thay tiền trong 9MUA nên có tỉ lệ, mức trần mỗi người và ngân sách tháng; tắt sẵn.

## 9. Câu hỏi còn mở

Không còn câu hỏi chặn việc viết code. CEO xác nhận đề xuất phụ đề (OpenAI Whisper) và Casso khi duyệt; tỉ lệ đổi điểm ra xu và
giá xu khi dùng chỉnh được trong Admin sau.
