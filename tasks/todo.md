# Task List: 9mua.com MVP

> Kế hoạch: `tasks/plan.md`. Spec: `SPEC-<module>.md`. Mỗi task: viết test trước → code → `npm run lint && npm test`
> → commit. Kích thước: S = 1–2 file, M = 3–5 file. Lệnh test focused: `npx vitest run src/modules/<id>`.
>
> Mọi task phải đạt **Definition of Done** chung trước khi tick:
> - Lint và test xanh.
> - Không còn TODO treo.
> - Không log dữ liệu nhạy cảm.
> - Spec được cập nhật nếu quyết định thay đổi.

---

## Phase 0 — Nền móng

- [x] **T1: Khởi tạo app Next.js + giao diện thương hiệu** (M)
  - Next 15 App Router, TS strict, Tailwind 4 với token trong `docs/BRAND.md`, font Be Vietnam Pro,
    ESLint + Prettier. Layout có header (icon túi số 9 + chữ 9MUA) và footer. Có `/api/health`, favicon,
    manifest PWA, OG mặc định.
  - Acceptance:
    - `npm run dev` hiện trang chủ tạm có logo đúng màu.
    - `/api/health` trả `{ok:true}`.
    - Lighthouse không báo lỗi tương phản.
  - Verify: `npm run lint && npm run build`. Mở thử trên giả lập iPhone.
  - Deps: —
  - Files: `package.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`,
    `public/manifest.webmanifest`

- [x] **T2: Prisma + Postgres + bộ khung test** (M)
  - `docker-compose.dev.yml` (Postgres 16), `prisma/schema.prisma` rỗng có generator,
    `src/lib/db.ts`, `src/lib/env.ts` (Zod kiểm biến môi trường), Vitest với DB test tự reset mỗi file,
    đồng hồ giả `src/lib/clock.ts` để test các mốc 48 giờ / 7 ngày.
  - Acceptance:
    - `npm test` chạy được 1 test mẫu đọc/ghi DB thật.
    - Thiếu biến môi trường thì app báo lỗi rõ ràng khi khởi động.
  - Verify: `docker compose -f docker-compose.dev.yml up -d && npm test`.
  - Deps: T1
  - Files: `docker-compose.dev.yml`, `prisma/schema.prisma`, `src/lib/{db,env,clock}.ts`, `vitest.config.ts`,
    `tests/setup.ts`

- [x] **T3: Đóng gói Docker production + mẫu Nginx + tài liệu deploy** (M)
  - Dockerfile multi-stage (Next standalone, Node 22, có sẵn ffmpeg cho worker). `docker-compose.yml`
    gồm `app` (chỉ `127.0.0.1:3009`), `db` (volume, không mở cổng), `worker` (tạm thời chỉ log).
    Thêm `deploy/nginx/9mua.conf` (9mua.com + `*.9mua.com` → 3009, giữ `Host`, `/uploads` phục vụ
    tĩnh, giới hạn body cho route video), `.env.example`, `docs/deploy.md` (cài Docker, SSL wildcard
    DNS-01, cron, backup DB hằng ngày).
  - Acceptance:
    - Trên máy sạch, `docker compose up -d --build` xong thì `curl 127.0.0.1:3009/api/health` trả 200.
    - Image web chỉ thêm ~100MB trên image Node. Prisma CLI tách sang target `migrator`.
    - `nginx -t` hợp lệ với file mẫu.
  - Verify: build và chạy compose trong container, chạy `nginx -t` bằng image nginx chính thức.
  - Deps: T2
  - Files: `Dockerfile`, `docker-compose.yml`, `deploy/nginx/9mua.conf`, `.env.example`, `docs/deploy.md`

### ✅ Checkpoint A — Nền móng
- [ ] Lint, test, build xanh. Docker chạy được.
- [ ] Push lên GitHub (cần CEO đã liên kết GitHub).
- [ ] CEO xem ảnh chụp trang có logo.

---

## Phase 1 — Tài khoản (`SPEC-identity.md`)

- [x] **T4: Đăng ký** (M)
  - Model `User`, chuẩn hoá SĐT/email, băm argon2id, `register()`, trang `/dang-ky`.
  - Acceptance:
    - SĐT và email đều đăng ký được.
    - Trùng định danh dù khác cách viết thì bị từ chối.
    - DB không chứa mật khẩu gốc.
  - Verify: `npx vitest run src/modules/identity`.
  - Deps: T2
  - Files: `prisma/schema.prisma`, `src/modules/identity/{identifier,password,register}.ts` + test,
    `src/app/(auth)/dang-ky/page.tsx`

- [x] **T5: Đăng nhập, phiên, khoá sau 5 lần sai** (M)
  - Model `Session` (lưu mã băm token), cookie `.9mua.com`, `login/logout/getCurrentUser/requireUser`,
    rate-limit theo định danh, `/dang-nhap`, header hiện tên người dùng.
  - Acceptance:
    - Đăng nhập rồi vẫn đăng nhập khi sang `abc.localhost`.
    - Lần sai thứ 6 trong 15 phút bị chặn.
    - Token trong DB là mã băm.
  - Verify: vitest identity. E2E đăng ký → đăng xuất → đăng nhập.
  - Deps: T4
  - Files: `src/modules/identity/{session,login,rate-limit,index}.ts` + test, `src/app/(auth)/dang-nhap/page.tsx`,
    `e2e/auth.spec.ts`

- [x] **T6: Email + quên mật khẩu** (M)
  - `src/lib/mail` (nodemailer SMTP Brevo, driver console/hộp thư giả cho dev/test, mẫu email có logo).
    Model `PasswordResetToken`, `/quen-mat-khau`, `/dat-lai-mat-khau`.
  - Acceptance:
    - Link dùng 1 lần, hết hạn sau 30 phút. Đặt lại xong thì huỷ mọi phiên.
    - Email chưa đăng ký nhận cùng một thông báo.
    - Tối đa 3 yêu cầu/giờ cho mỗi email.
  - Verify: vitest identity (đọc mail từ hộp thư giả).
  - Deps: T5
  - Files: `src/lib/mail/{index,templates}.ts`, `src/modules/identity/reset.ts` + test,
    `src/app/(auth)/{quen-mat-khau,dat-lai-mat-khau}/page.tsx`

- [x] **T7: Trang tài khoản, quyền admin, lệnh tạo CEO** (M)
  - `/tai-khoan` (sửa thông tin, thêm email, đổi mật khẩu, đăng xuất mọi thiết bị). Thêm `lockUser`,
    `resetPassword`, `requireAdmin` (trả 404), và script `user:create-admin` (nhập mật khẩu ẩn).
  - Acceptance:
    - Đổi mật khẩu thì huỷ phiên khác.
    - Tài khoản bị khoá không đăng nhập được.
    - `requireAdmin` trả 404 cho tài khoản thường.
  - Verify: vitest identity. Chạy script tạo admin trong Docker.
  - Deps: T6
  - Files: `src/modules/identity/{account,admin}.ts` + test, `src/app/tai-khoan/page.tsx`, `scripts/create-admin.ts`

### ✅ Checkpoint B — Tài khoản
- [x] Mọi tiêu chí Success Criteria của `SPEC-identity.md` đạt. Riêng HTTPS và cookie `.9mua.com` thật
      sẽ kiểm tra lại trên VPS ở T37.
- [x] E2E auth xanh (5 kịch bản). Đã review bảo mật phần phiên và cookie, kết quả ở dưới.
- [ ] Push lên GitHub: **bị chặn**, chờ CEO cài Claude GitHub App cho repo. Tạm thời gửi CEO bản git bundle.

**Review bảo mật phiên và cookie (23/10/2026):**
- OK — Token 32 byte ngẫu nhiên, DB chỉ lưu SHA-256. Cookie `httpOnly`, `SameSite=Lax`, `Secure` khi chạy HTTPS.
- OK — Server Action của Next.js tự kiểm `Origin` khớp `Host`, cộng với SameSite=Lax là đủ chống CSRF.
  Không mở `serverActions.allowedOrigins`.
- OK — Chống open redirect (`safeNextPath`). Link đặt lại mật khẩu dùng `referrer: no-referrer`.
- OK — Đăng nhập trả lỗi chung, thời gian phản hồi gần như nhau nhờ hash giả. Khoá theo định danh sau 5 lần sai.
- Theo dõi — Chưa giới hạn theo IP: kẻ tấn công thử nhiều tài khoản, mỗi tài khoản một mật khẩu
  (password spraying) vẫn lọt. Bổ sung rate-limit theo IP ở Nginx (`limit_req` cho `/dang-nhap`)
  trong T36.
- Theo dõi — Trang đăng ký báo "Tài khoản đã tồn tại", nên lộ được số điện thoại nào đã đăng ký. Đây là
  đánh đổi chấp nhận được cho trải nghiệm người dùng. Giảm thiểu bằng rate-limit IP ở T36.
- Theo dõi — Đổi email chưa xác minh quyền sở hữu (đã báo CEO). Làm sau MVP: gửi link xác nhận về email mới.

---

## Phase 2 — Kiot (`SPEC-kiot.md`)

- [x] **T8: Tạo Kiot (bản nháp)** (M)
  - Model `Kiot`, tạo slug bỏ dấu tiếng Việt, danh sách slug cấm, kiểm slug trùng ngay khi gõ,
    `/kiot-cua-toi/tao`, bảng điều khiển `/kiot-cua-toi` (trạng thái nháp), `isKiotActive`.
  - Acceptance:
    - "Thanh Long Bình Thuận" gợi ý `thanh-long-binh-thuan`.
    - Slug cấm hoặc trùng bị từ chối. Mỗi tài khoản chỉ 1 Kiot.
    - Slug chỉ đổi được khi còn nháp.
  - Verify: `npx vitest run src/modules/kiot`.
  - Deps: T7
  - Files: `src/modules/kiot/{slug,reserved-slugs,kiot,index}.ts` + test, `src/app/kiot-cua-toi/{page,tao/page}.tsx`

- [x] **T9: Xử lý và lưu ảnh** (S)
  - Interface `ImageStore` (ổ đĩa local). Pipeline sharp: kiểm magic bytes, đổi sang WebP 1200px + bản
    thu nhỏ 400px, xoá EXIF, tên file ngẫu nhiên.
  - Acceptance:
    - Ảnh 8MB có GPS thành WebP ≤ 300KB, không còn GPS.
    - File giả đuôi `.jpg` bị từ chối.
    - HEIC: iPhone tự đổi sang JPEG ở ô chọn ảnh; server từ chối HEIC kèm hướng dẫn (xem SPEC-kiot.md).
  - Verify: vitest với ảnh mẫu trong `tests/fixtures`.
  - Deps: T2
  - Files: `src/lib/media/{image-store,process-image}.ts` + test, `tests/fixtures/*`

- [x] **T10: Quản lý sản phẩm** (M)
  - Model `Product` + `ProductImage`, CRUD có kiểm chủ Kiot ở server, 12 danh mục, xoá mềm, sắp thứ
    tự ảnh, tối đa 500 sản phẩm, giao diện `/kiot-cua-toi/san-pham`.
  - Acceptance:
    - Thêm, sửa, ẩn, xoá sản phẩm có 1–6 ảnh.
    - Người khác không sửa được sản phẩm của mình.
    - Giá và giá gốc được kiểm hợp lệ.
  - Verify: vitest kiot. Thử tay trên điện thoại.
  - Deps: T8, T9
  - Files: `src/modules/kiot/{product,categories}.ts` + test, `src/app/kiot-cua-toi/san-pham/**`

- [x] **T11: Tên miền phụ + trang Kiot công khai** (M)
  - `middleware.ts` chuyển `<slug>.9mua.com` sang `/k/<slug>`. Trang Kiot, trang sản phẩm, thẻ OG,
    trang "Kiot tạm ngưng" (404), nút tạo QR link Kiot.
  - Acceptance:
    - `slug.localhost:3000` hiện Kiot đang hoạt động.
    - Kiot nháp chỉ chủ xem được. Kiot khoá hoặc hết hạn thì 404 "tạm ngưng".
    - Link sản phẩm chia sẻ có ảnh và giá.
  - Verify: vitest middleware. E2E bằng `extendActiveUntil` giả.
  - Deps: T10
  - Files: `src/middleware.ts`, `src/app/k/[slug]/{page,p/[id]/page}.tsx`, `src/modules/kiot/public.ts` + test,
    `e2e/kiot.spec.ts`

- [x] **T12: Tài khoản nhận tiền + tồn kho an toàn đồng thời** (M)
  - Danh sách ngân hàng VietQR. Đổi tài khoản phải nhập lại mật khẩu, có lịch sử và gửi email báo.
    Viết `getPayoutAccount`, `decrementStock`/`restoreStock` (UPDATE có điều kiện), `lockKiot`, `hideProduct`.
  - Acceptance:
    - 20 lệnh trừ kho song song trên tồn kho 5 thì đúng 5 lệnh thành công, tồn kho bằng 0.
    - Đổi tài khoản sai mật khẩu bị từ chối. Đổi được thì có email báo.
    - STK không bao giờ xuất hiện trên trang công khai.
  - Verify: vitest kiot (test đồng thời trên Postgres thật).
  - Deps: T10
  - Files: `src/modules/kiot/{payout-account,stock,banks}.ts` + test, `src/app/kiot-cua-toi/cai-dat/page.tsx`

### ✅ Checkpoint C — Kiot
- [x] Success Criteria `SPEC-kiot.md` đạt, trừ LCP (đo ở Phase 9). 168 unit + 9 E2E xanh.
- [x] Đã chụp màn hình trang Kiot và trang sản phẩm trên iPhone. CEO yêu cầu làm liên tục, không dừng ở checkpoint.
- Ghi chú: danh sách 43 ngân hàng lấy từ vietnam-qr-pay@1.5.1, đã đối chiếu 23 BIN phổ biến; kiểm lại với
  api.vietqr.io khi deploy (T37).

---

## Phase 3 — Thu tiền PayOS + phí thuê (`SPEC-payments.md`, `SPEC-billing.md`)

- [x] **T13: Lõi payments + driver giả** (M)
  - Model `PaymentIntent`, `PaymentEvent`, sequence `orderCode`. Wrapper `@payos/node` và driver `fake`
    (bị chặn ở production). `createPayment` không tạo trùng, `registerPaymentHandler`, chuẩn hoá mô tả 9 ký tự.
  - Acceptance:
    - Gọi `createPayment` 2 lần trả cùng một intent.
    - Driver `fake` bị từ chối khi `NODE_ENV=production`.
    - Mô tả luôn ≤ 9 ký tự, chỉ gồm `A-Z0-9`.
  - Verify: `npx vitest run src/modules/payments`.
  - Deps: T2
  - Files: `src/modules/payments/{client,fake-driver,create,registry,index}.ts` + test

- [x] **T14: Webhook PayOS** (M)
  - `POST /api/payos/webhook`: kiểm chữ ký, ghi sổ idempotent, so số tiền, gọi handler trong
    transaction, xử lý `mismatch` và webhook mồ côi. Trang `/dev/payos/<orderCode>` giả lập trả đủ/thiếu.
  - Acceptance:
    - Gửi 5 webhook giống nhau song song thì handler chạy đúng 1 lần.
    - Sai chữ ký trả 400 và DB không đổi.
    - Handler lỗi thì rollback, trả 500, và gửi lại sau đó thì thành công.
  - Verify: vitest payments, kèm test hợp đồng: `webhooks.verify` của SDK thật chấp nhận payload do driver giả ký.
  - Deps: T13
  - Files: `src/app/api/payos/webhook/route.ts`, `src/modules/payments/{webhook,process-paid}.ts` + test,
    `src/app/dev/payos/[orderCode]/page.tsx`

- [x] **T15: Đối soát, huỷ, đăng ký webhook** (S)
  - `/api/internal/payments/reconcile`, kiểm trạng thái khi người dùng quay về `returnUrl`, `cancelPayment`,
    script `payos:confirm-webhook`, guard `src/lib/internal-route.ts` dùng chung. Guard kiểm header
    `X-Internal-Token` so với `INTERNAL_CRON_TOKEN` bằng so sánh thời gian hằng. Không dựa vào IP, vì trong
    Docker mọi request đều đến từ gateway của bridge (phát hiện ở T3). Nginx trả 404 cho `/api/internal/*`.
  - Acceptance:
    - Không có webhook mà PayOS báo `PAID` thì đối soát cho kết quả giống hệt webhook.
    - Gọi route internal thiếu hoặc sai token trả 404.
  - Verify: vitest payments.
  - Deps: T14
  - Files: `src/modules/payments/{reconcile,cancel}.ts` + test, `src/app/api/internal/payments/reconcile/route.ts`,
    `src/lib/internal-route.ts`, `scripts/payos-confirm-webhook.ts`

- [x] **T16: Kích hoạt Kiot 26.000đ** (M)
  - Bảng `Setting` (phí mặc định 26000) và `KiotSubscription`. `startKiotPayment`, handler `onPaid`
    (cộng dồn hạn, gọi `extendActiveUntil`), trang QR tự kiểm tra mỗi 3 giây, email biên nhận,
    lịch sử thanh toán.
  - Acceptance:
    - Nháp → trả (giả lập) → Kiot công khai 1 năm.
    - Gia hạn khi còn 100 ngày thì hạn mới = hạn cũ + 1 năm.
    - Webhook trùng không cộng thêm năm. Kiot bị khoá không tạo được thanh toán.
  - Verify: vitest billing. E2E kích hoạt Kiot.
  - Deps: T11, T15
  - Files: `src/modules/billing/{fee,subscription,index}.ts` + test, `src/lib/settings.ts`,
    `src/app/kiot-cua-toi/thanh-toan/{page,[intentId]/page}.tsx`, `e2e/billing.spec.ts`

- [x] **T17: Nhắc hết hạn, tặng năm, doanh thu phí** (S)
  - `/api/internal/billing/reminders` (mốc 14, 3, 0 ngày, không gửi trùng), `grantYear`, `setKiotFee`,
    `listExpiringKiots`, `revenueSummary`, banner nhắc trong `/kiot-cua-toi`.
  - Acceptance:
    - Cron chạy 2 lần/ngày chỉ gửi 1 email mỗi mốc.
    - Đổi phí không ảnh hưởng QR đang chờ.
  - Verify: vitest billing (đồng hồ giả).
  - Deps: T16
  - Files: `src/modules/billing/{reminders,admin}.ts` + test, `src/app/api/internal/billing/reminders/route.ts`

### ✅ Checkpoint D — Kiot mở bán thật
- [x] Luồng tạo Kiot → trả → công khai chạy hết bằng driver giả (E2E, kể cả mất webhook).
- [ ] **Khi CEO có key PayOS:** thử trả 2.000đ thật trên VPS, xác nhận giới hạn mô tả 9 ký tự → làm ở T37.
- [x] Tự review `payments`:
  - Chữ ký kiểm bằng SDK trước khi đọc dữ liệu.
  - Ghi nhận idempotent theo (orderCode, reference), có khoá intent `FOR UPDATE`.
  - So khớp số tiền, `mismatch` không kích hoạt.
  - Sổ cái chỉ thêm, chặn bằng trigger DB.
  - Driver giả bị chặn ở production.
  - Route nội bộ có token.

---

## Phase 4 — Đơn hàng thu hộ (`SPEC-orders.md`)

- [x] **T18: Giỏ hàng + phí ship** (M)
  - Model `CartItem`. `addToCart` (bắt đăng nhập rồi tự thêm lại), `/gio-hang` nhóm theo Kiot có cảnh báo
    hết hàng hoặc Kiot ngưng. Cài đặt phí ship và ngưỡng miễn phí trong Kiot. Nút "Thêm vào giỏ" trên trang sản phẩm.
  - Acceptance:
    - Chưa đăng nhập bấm thêm → đăng nhập → món đã nằm trong giỏ.
    - Không vượt tồn kho, tối đa 50 dòng.
    - Tổng tiền và phí ship tính đúng theo từng Kiot.
  - Verify: `npx vitest run src/modules/orders`.
  - Deps: T12, T7
  - Files: `src/modules/orders/{cart,shipping}.ts` + test, `src/app/gio-hang/page.tsx`, `src/components/AddToCart.tsx`

- [x] **T19: Đặt hàng + thanh toán 1 QR nhiều Kiot** (M)
  - Model `Checkout`, `Order`, `OrderItem`. `placeOrder` trong 1 transaction (đọc lại giá, giữ hàng,
    chụp lại thông tin món và tỉ lệ phí sàn), địa chỉ nhận hàng, trang QR. Handler `onPaid`, xử lý
    trường hợp trả muộn.
  - Acceptance:
    - Giỏ 2 Kiot → 1 QR → 2 đơn `paid`, mỗi người bán nhận 1 email.
    - 2 người cùng mua món cuối thì 1 người nhận `OUT_OF_STOCK`.
    - Trả muộn khi hết hàng thì đơn chuyển `refund_pending`.
  - Verify: vitest orders.
  - Deps: T18, T15
  - Files: `src/modules/orders/{place-order,on-paid}.ts` + test, `src/app/dat-hang/{page,[intentId]/page}.tsx`

- [x] **T20: Máy trạng thái đơn + màn hình người bán** (M)
  - `transition()` với bảng chuyển trạng thái đầy đủ, ghi `OrderEvent`. `/kiot-cua-toi/don-hang`:
    xác nhận, từ chối, giao hàng (mã vận đơn), chỉ hiện thông tin người mua khi đơn đã trả. Email theo trạng thái.
  - Acceptance:
    - Mọi cặp (trạng thái, hành động, vai trò) ngoài bảng đều bị từ chối.
    - Người bán A không thấy đơn của B. Đơn chưa trả không lộ SĐT người mua.
  - Verify: vitest orders (test bảng chuyển trạng thái đầy đủ).
  - Deps: T19
  - Files: `src/modules/orders/{state-machine,transition,notify}.ts` + test, `src/app/kiot-cua-toi/don-hang/**`

- [x] **T21: Người mua, khiếu nại, tác vụ định kỳ, hoàn tất** (M)
  - `/don-mua` (đã nhận, báo vấn đề kèm 3 ảnh, nhập tài khoản hoàn tiền). `/api/internal/orders/tick`
    (15 phút, 48 giờ, 10 ngày, 7 ngày), hook `onOrderCompleted`, `listRefundsPending`, `listDisputes`.
  - Acceptance:
    - Đồng hồ giả: đơn tự đi `shipping → delivered → completed` đúng các mốc.
    - Hai lệnh tick chạy song song thì hook hoàn tất vẫn chỉ chạy 1 lần.
    - Đơn bị khiếu nại không tự hoàn tất.
  - Verify: vitest orders. E2E mua → giao → nhận → +7 ngày → hoàn tất.
  - Deps: T20
  - Files: `src/modules/orders/{tick,dispute,refund}.ts` + test, `src/app/don-mua/**`, `e2e/orders.spec.ts`

### ✅ Checkpoint E — Đơn hàng
- [x] Success Criteria `SPEC-orders.md` đạt (unit + E2E vòng đời đầy đủ).
- [x] Tự review `orders`:
  - Quyền sở hữu được kiểm ở server trong `transition()`.
  - Người bán chỉ thấy địa chỉ/SĐT người mua khi đơn đã thanh toán.
  - Đồng thời: khoá đơn `FOR UPDATE`, trừ kho có điều kiện, tick chạy chồng an toàn.
  - `OrderItem`/`OrderEvent` chỉ thêm (trigger DB).
  - Chủ Kiot không tự mua hàng của mình (quyết định thêm, cần báo CEO).
- Theo dõi: email nhắc người mua nhập tài khoản hoàn tiền mới gửi 1 lần lúc chuyển `refund_pending`;
  nhắc lặp lại để T35 (cảnh báo/bản tin).

---

## Phase 5 — Số dư + chi trả (`SPEC-payouts.md`)

- [x] **T22: Sổ số dư + trang số dư** (M)
  - Model `BalanceEntry`, `PlatformRevenue`. Đăng ký `onOrderCompleted` (tính phí sàn trên tiền hàng),
    `getBalance`, `/kiot-cua-toi/so-du`.
  - Acceptance:
    - Đơn hoàn tất → số dư = tổng − phí. Hook chạy 2 lần chỉ cộng 1 lần.
    - "Đang chờ" hiện đúng tổng các đơn chưa hoàn tất.
  - Verify: `npx vitest run src/modules/payouts`.
  - Deps: T21
  - Files: `src/modules/payouts/{ledger,fees,index}.ts` + test, `src/app/kiot-cua-toi/so-du/page.tsx`

- [x] **T23: Xác minh CCCD (KYC)** (S)
  - Model `KycSubmission`. Ảnh lưu thư mục riêng tư, route xem ảnh chỉ cho admin. `submitKyc`,
    `reviewKyc`, so tên CCCD với tên tài khoản ngân hàng.
  - Acceptance:
    - Ảnh KYC không truy cập được qua `/uploads`.
    - Tài khoản thường gọi route xem ảnh nhận 404.
    - Tên khác nhau thì có cờ cảnh báo.
  - Verify: vitest payouts.
  - Deps: T22, T9
  - Files: `src/modules/payouts/kyc.ts` + test, `src/app/kiot-cua-toi/xac-minh/page.tsx`, `src/app/api/admin/kyc/[id]/[side]/route.ts`

- [x] **T24: Yêu cầu rút + duyệt tay + QR VietQR** (M)
  - Model `PayoutRequest`. `requestPayout` (kiểm tối thiểu, KYC, tài khoản đổi > 24 giờ, phí chi hộ,
    khoá theo Kiot), `cancelPayout`, `markPayoutPaid`, `rejectPayout`, tạo chuỗi VietQR EMVCo,
    giao diện rút tiền hiện "Bạn sẽ nhận X đ (phí Y đ)".
  - Acceptance:
    - 10 yêu cầu song song bằng toàn bộ số dư thì đúng 1 cái thành công.
    - QR tạo ra đọc lại đúng STK và số tiền.
    - Từ chối hoặc huỷ thì số dư quay về đúng như trước.
  - Verify: vitest payouts (giải mã QR trong test).
  - Deps: T23
  - Files: `src/modules/payouts/{request,manual,vietqr}.ts` + test, `src/app/kiot-cua-toi/so-du/rut/page.tsx`

- [x] **T25: Chi tự động qua PayOS** (M)
  - Client chi hộ trong `payments` (kèm driver giả), `evaluateAutoRules` (đủ 8 luật), gửi lệnh với
    `idempotencyKey = payoutId`, `/api/internal/payouts/sync`, `approvePayoutViaPayos`, cảnh báo quỹ chi thấp.
  - Acceptance:
    - Mỗi luật sai thì vào hàng chờ với đúng lý do. Đủ luật thì `processing → paid` tự động.
    - Lần gọi đầu hết thời gian chờ thì gọi lại vẫn chỉ có 1 lệnh chi. `FAILED` thì số dư được hoàn.
    - Tắt công tắc thì mọi yêu cầu mới vào hàng chờ.
  - Verify: vitest payouts + payments.
  - Deps: T24
  - Files: `src/modules/payments/payout-client.ts` + test, `src/modules/payouts/{auto-rules,auto-dispatch,sync}.ts` + test,
    `src/app/api/internal/payouts/sync/route.ts`
  - Ghi chú: làm sớm phần `AlertThrottle` của T35 (`src/lib/alerts.ts` + `/api/internal/alerts/flush`) vì
    T25 cần báo CEO. Lệnh PayOS từ chối rõ ràng (và tra lại theo mã RT không thấy) thì về hàng chờ CEO, gửi
    lại dùng khoá `payoutId-rN`; lỗi mạng/không rõ thì giữ `processing`, cron hỏi lại hoặc gửi lại cùng khoá.

### ✅ Checkpoint F — Dòng tiền khép kín
- [ ] E2E: tạo Kiot → bán → hoàn tất → KYC → rút lần 1 (duyệt tay) → rút lần 2 (tự động).
  - Đã có bản tích hợp (vitest `auto.test.ts`: lần 1 hàng chờ → "Chi qua PayOS" → paid → lần 2 tự động).
    Bản E2E qua trình duyệt: `e2e/admin.spec.ts` (T33).
- [x] Đối chiếu: tiền vào − hoàn − đã chi = tiền đang giữ (`custodyReport`, `report.test.ts`).
- [x] Rà soát `payouts` (đúng sai, bảo mật): chặn ghi đè ở DB (1 yêu cầu mở/Kiot, CHECK số tiền, sổ chỉ thêm),
  thời gian chờ PayOS ngắn lại để người bán không phải chờ lâu, giới hạn độ dài lý do và số tiền điều chỉnh.
  Hàm admin (`rejectPayout`, `markPayoutPaid`, `approvePayoutViaPayos`, `adjustBalance`) chưa có giao diện;
  T31/T33 phải gọi qua `requireAdmin` + 2FA và ghi audit log.

---

## Phase 6 — Chợ (`SPEC-marketplace.md`)

- [x] **T26a: Logo, ảnh bìa, địa chỉ lấy hàng của Kiot** (S) — bổ sung
  - SPEC-kiot.md mục 2 đã duyệt nhưng kế hoạch T9–T12 bỏ sót; Chợ cần tỉnh/thành để lọc và hiện trên thẻ.
  - 34 tỉnh/thành sau sắp xếp 01/07/2025 (lưu slug). Địa chỉ chi tiết không hiện công khai (chỉ tỉnh + quận).
  - Logo dùng ảnh 400px, ảnh bìa 1200px; đổi/gỡ thì xoá file cũ.
  - Verify: vitest `kiot/profile.test.ts`, E2E `kiot-profile.spec.ts`.

- [x] **T26: Tìm kiếm tiếng Việt + trang Chợ** (M)
  - Migration bật `unaccent` và `pg_trgm`, chỉ mục tìm kiếm. `searchProducts` (lọc, sắp xếp, con trỏ),
    bảng `ProductSalesStat` cập nhật qua `onOrderCompleted`. `/cho`, `/cho/[danh-muc]` giữ bộ lọc trên URL.
  - Acceptance:
    - "thnah long" / "THANH LONG" / "thanh lòng" đều ra "Thanh Long Bình Thuận".
    - Kiot hết hạn, bị khoá, sản phẩm ẩn hay bị gỡ đều không xuất hiện.
    - Seed 100.000 sản phẩm thì p95 < 300ms.
  - Verify: `npx vitest run src/modules/marketplace`, script đo hiệu năng.
  - Deps: T21
  - Files: `prisma/migrations/*search*`, `src/modules/marketplace/{search,stats}.ts` + test, `src/app/cho/**`
  - Kết quả đo (sandbox, `PERF=1 npx vitest run tests/perf`): 100.000 sản phẩm, p50 54ms, p95 183ms.
  - Ghi chú: tên khớp gần đúng (ngưỡng 0,4 để "thnah long" vẫn ra); mô tả chỉ khớp nguyên cụm; từ khoá
    < 4 ký tự chỉ khớp đầu từ. Tên chuẩn hoá lưu ở cột `searchName` (trigger DB tự điền).
    Trang danh mục dùng cache 60 giây trong tiến trình thay cho ISR (lúc build Docker chưa có DB).
    "Đã bán" lấy từ sổ `ProductSale` (chỉ thêm) + `ProductSalesStat`; cron 3:10 tính lại 30 ngày.

- [x] **T27: Trang chủ, danh bạ Kiot, báo cáo vi phạm, SEO** (M)
  - Trang chủ thật (khẩu hiệu, nút "Tạo Kiot – 26.000đ/năm", danh mục, bán chạy, mới, Kiot nổi bật,
    chỗ cho khối video), `/cho/kiot`, `reportProduct` (5 người thì tự ẩn), `sitemap.xml`, `robots.txt`.
  - Acceptance:
    - Mọi con số là số thật.
    - 5 báo cáo khác người thì tự ẩn sản phẩm.
    - Sitemap chỉ có Kiot và sản phẩm đang hoạt động.
  - Verify: vitest marketplace. E2E trang chủ → tìm → thêm giỏ.
  - Deps: T26
  - Files: `src/app/page.tsx`, `src/app/cho/kiot/page.tsx`, `src/modules/marketplace/{home,reports}.ts` + test,
    `src/app/{sitemap,robots}.ts`
  - Ghi chú: chưa Kiot nào có đơn hoàn tất 30 ngày thì khối đổi tên thành "Kiot mới mở" (không giả số).
    Nút "Tạo Kiot" lấy phí thật từ cài đặt; đã đăng nhập thì /dang-ky chuyển thẳng tới trang cần tới.
    Sitemap gồm link tenkiot.9mua.com — CEO cần xác minh 9mua.com dạng Domain property trên Search Console.
    Thêm `tests/db-guards.test.ts`: Prisma từng tự sinh lệnh xoá chỉ mục tìm kiếm (đã chặn bằng khai báo
    `@@index(... type: Gin)`), test này bắt mọi migration lỡ xoá trigger/CHECK/chỉ mục viết tay.

## Phase 7 — Creator video (`SPEC-creator.md`), làm song song với Phase 6

- [x] **T28: Đăng video + worker ffmpeg** (M)
  - Model `Video`, `VideoProduct`, `VideoJob`. Route tải lên (≤ 100MB, ≤ 10 video/ngày), worker lấy
    việc bằng `SKIP LOCKED`, chạy ffprobe/ffmpeg với tham số cố định và giới hạn 5 phút, ra 720p
    H.264 + ảnh bìa, xoá file gốc. Có video mẫu trong `tests/fixtures`.
  - Acceptance:
    - MOV HEVC của iPhone → MP4 H.264 ≤ 720×1280 có ảnh bìa, không còn GPS.
    - File 75 giây → `failed`. Hai worker không xử lý trùng một video.
  - Verify: `npx vitest run src/modules/creator` (cần ffmpeg, chạy trong Docker).
  - Deps: T12, T3
  - Files: `src/modules/creator/{upload,transcode,jobs}.ts` + test, `worker/index.ts`, `src/app/video/dang/page.tsx`
  - Ghi chú: tải lên 2 bước (PUT file thô có thanh tiến trình → tạo video). App chỉ kiểm chữ ký đầu file
    (không cần ffmpeg trong image web); worker kiểm kỹ bằng ffprobe. File gốc nằm trong PRIVATE_DIR, xoá sau
    khi xử lý; file bỏ dở xoá sau 24 giờ. Thêm bảng `Notification` (thông báo trong app).
    E2E dùng `/api/internal/video/process` (chỉ khi TEST_MODE=e2e) thay cho container worker.

- [x] **T29: Feed 9:16 + thích, xem, mua từ video** (M)
  - `/video` toàn màn hình (vuốt, tự phát tắt tiếng, tải trước video kế), `getFeed` theo công thức
    điểm, `recordView` (≥ 3 giây, 24 giờ), `toggleLike`, thẻ sản phẩm → `addToCart(sourceVideoId)`,
    trang chia sẻ `/v/[id]` có OG.
  - Acceptance:
    - Video mới chưa có tương tác vẫn lên feed.
    - Thẻ sản phẩm của Kiot ngưng tự ẩn.
    - Món mua từ video có `sourceVideoId` trong giỏ.
  - Verify: vitest creator. E2E trên giả lập iPhone.
  - Deps: T28, T18
  - Files: `src/modules/creator/{feed,engagement}.ts` + test, `src/app/video/page.tsx`, `src/app/v/[id]/page.tsx`,
    `src/components/VideoFeed.tsx`
  - Ghi chú: con trỏ feed mang danh sách video đã xem trong phiên (không lặp), cứ ~3 video theo điểm chèn
    1 video mới nhất. Lượt xem tính theo ngày giờ VN (khoá videoId+người xem+ngày như spec), gửi theo lô
    bằng sendBeacon. Nguồn video trong giỏ chỉ được ghi khi video thật sự gắn sản phẩm đó. Điểm feed tính lại
    mỗi 5 phút trong worker. Chromium của Playwright không giải mã H.264 nên E2E không đo thời gian xem.

- [x] **T30: Trang creator, thống kê, kiểm duyệt, Video hot** (S)
  - `/creator/[userId]`, `/video/cua-toi` (lượt xem, thích, số đơn từ video), xoá video, báo cáo
    (5 người thì tự ẩn), `removeVideo`, `getHotVideos`, khối "Video hot" trên trang chủ.
  - Acceptance:
    - Đơn hoàn tất từ video tăng thống kê đúng 1.
    - Tài khoản bị khoá thì video biến khỏi feed.
  - Verify: vitest creator.
  - Deps: T29, T27
  - Files: `src/modules/creator/{profile,moderation}.ts` + test, `src/app/creator/[userId]/page.tsx`, `src/app/video/cua-toi/page.tsx`

### ✅ Checkpoint G — Chợ + Creator
- [x] Success Criteria `SPEC-marketplace.md` và `SPEC-creator.md` đạt (trừ chỉ số đo trên VPS thật):
  tìm không dấu/sai nhẹ, không lộ Kiot hết hạn/bị khoá, số liệu thật, link lọc chia sẻ được; video iPhone
  chuyển mã H.264, mua từ video ghi đúng nguồn, worker tách riêng.
- [x] `/webperf` cho trang chủ, Chợ, feed video → đã đo ở T36 (`e2e/perf.spec.ts`), đều đạt.

---

## Phase 8 — Trang CEO (`SPEC-admin.md`)

- [x] **T31: Khung admin + 2 lớp + audit log** (M)
  - Model `AdminTotp`, `AdminAuditLog`. Thêm `src/lib/audit.ts`, cài và kiểm TOTP (`otplib`), mã dự
    phòng, phiên admin 12 giờ, layout `/admin`. **Test quét mọi route admin.**
  - Acceptance:
    - Tài khoản thường vào mọi route `/admin/**` (cả trang lẫn API) đều 404.
    - Chưa nhập mã TOTP thì không thao tác được. Sai 5 lần thì khoá 15 phút.
    - Mã dự phòng dùng 1 lần là hết hiệu lực.
  - Verify: `npx vitest run src/modules/admin`.
  - Deps: T7
  - Files: `src/modules/admin/{totp,guard}.ts` + test, `src/lib/audit.ts`, `src/app/admin/{layout,xac-thuc/page}.tsx`,
    `tests/admin-routes.test.ts`
  - Ghi chú: `otplib` 13.5.0 (bản cố định). Bí mật TOTP mã hoá AES-256-GCM bằng `APP_ENCRYPTION_KEY`
    (bắt buộc ở production), chống dùng lại mã (time step), sai 5 lần khoá 15 phút, 10 mã dự phòng băm.
    Trạng thái "phiên đã qua 2 lớp" lưu ở bảng riêng của admin (không sửa bảng Session của identity).
    Nhật ký thao tác ghi ở tầng action của admin (`src/lib/audit.ts`) thay vì sửa từng hàm của module
    khác — không phải đổi hợp đồng `index.ts` của các module, mà mỗi thao tác trên giao diện CEO vẫn có
    đúng 1 dòng nhật ký.

- [x] **T32: Tổng quan + hộp "Cần xử lý"** (S)
  - Số liệu Hôm nay / 7 / 30 ngày, biểu đồ SVG doanh thu, các bộ đếm hàng chờ có link.
  - Acceptance:
    - Số liệu khớp dữ liệu mẫu đã biết trước kết quả.
    - Hiển thị gọn trên màn hình 375px.
  - Verify: vitest admin.
  - Deps: T31, T25, T30
  - Files: `src/modules/admin/metrics.ts` + test, `src/app/admin/page.tsx`, `src/components/admin/LineChart.tsx`
  - Ghi chú: test E2E 375px phát hiện thanh trên của toàn site tràn ngang khi đã đăng nhập (thêm chuông
    thông báo ở T30) — đã sửa: màn ≤ 400px chỉ hiện biểu tượng logo, thu gọn khoảng cách.

- [x] **T33: Các hàng chờ xử lý** (M)
  - Rút tiền (Chi qua PayOS / Chuyển tay + QR / Từ chối), KYC, Hoàn tiền, Khiếu nại, Lệch tiền, Báo cáo.
    Mỗi thao tác đều hỏi xác nhận và bắt nhập lý do khi cần.
  - Acceptance:
    - Mỗi việc xong trong ≤ 2 chạm.
    - Mỗi thao tác sinh đúng 1 dòng audit log có before/after.
  - Verify: vitest admin. E2E rút tiền qua PayOS giả.
  - Deps: T32
  - Files: `src/app/admin/{rut-tien,kyc,hoan-tien,khieu-nai,lech-tien,bao-cao}/page.tsx`, `src/app/admin/actions.ts`,
    `e2e/admin.spec.ts`
  - Ghi chú: thêm bảng `PaymentIssueResolution` (payments) để "đánh dấu đã xử lý" khoản lệch tiền;
    `resolveProductReports` (marketplace), `listPayoutQueue` (payouts), `listFailedVideoJobs` (creator).
    Lớp `src/modules/admin/queues.ts` gọi hàm của module sở hữu và ghi nhật ký trước/sau. E2E Checkpoint F
    (rút lần 1 duyệt tay qua giao diện CEO) đã có trong `e2e/admin.spec.ts`.

- [x] **T34: Tra cứu, xuất CSV, cài đặt** (M)
  - Tìm người dùng, Kiot, đơn hàng. Khoá/mở, tặng năm, điều chỉnh số dư. Sổ giao dịch xuất CSV
    (UTF-8 có BOM). Trang cài đặt có kiểm hợp lệ, công tắc chi tự động màu đỏ.
  - Acceptance:
    - CSV mở bằng Excel không lỗi font.
    - Phí sàn ngoài khoảng 0–30% bị từ chối.
    - Đổi cài đặt có ghi audit log.
  - Verify: vitest admin.
  - Deps: T33
  - Files: `src/app/admin/{nguoi-dung,kiot,don-hang,giao-dich,cai-dat}/**`, `src/modules/admin/export.ts` + test
  - Ghi chú: gộp tra cứu người dùng/Kiot/đơn vào một trang `/admin/tra-cuu`. Mật khẩu tạm hiện ngay trên
    trang (không đưa lên URL để không lọt vào log). CSV chặn chèn công thức Excel; mỗi lần xuất ghi nhật ký.

- [x] **T35: Email cảnh báo + bản tin 8:00** (S)
  - Model `AlertThrottle`. Báo ngay: lệch tiền, chi lỗi, quỹ chi thấp, khiếu nại mới. Bản tin hằng
    ngày qua `/api/internal/admin/digest`.
  - Acceptance:
    - 10 sự việc cùng loại trong 15 phút gộp vào 1 email.
    - Bản tin có số liệu hôm qua và việc cần làm.
  - Verify: vitest admin (hộp thư giả).
  - Deps: T34
  - Files: `src/modules/admin/{alerts,digest}.ts` + test, `src/app/api/internal/admin/digest/route.ts`
  - Ghi chú: phần gộp/hạn mức cảnh báo đã làm ở T25 (`src/lib/alerts.ts`). T35 thêm báo ngay khi tiền vào
    bất thường (thiếu/thừa/không khớp/trả 2 lần) và khiếu nại mới; bản tin 8:05 kèm nhắc người mua nhập tài
    khoản nhận hoàn tiền (đơn chờ hoàn > 24 giờ).

### ✅ Checkpoint H — Trang CEO
- [x] Success Criteria `SPEC-admin.md` đạt (trên điện thoại ≤ 2 chạm; người ngoài nhận 404; lộ mật khẩu vẫn
  cần mã 2 lớp; mọi thao tác có nhật ký; CSV mở bằng Excel; email cảnh báo + bản tin).
- [x] Rà soát phân quyền admin: layout + từng trang + từng Server Action + API đều chặn (test quét tự động);
  bước cài 2 lớp chỉ mở cho tài khoản đã là admin; mật khẩu tạm không đưa lên URL; thêm lệnh CLI
  `--reset-2fa` khi CEO mất cả điện thoại lẫn mã dự phòng. Rủi ro còn lại: từ lúc chạy CLI nâng quyền tới lúc
  CEO cài 2 lớp, ai có mật khẩu CEO có thể cài trước → hướng dẫn cài ngay (docs/deploy.md).

---

## Phase 9 — Ra mắt

- [x] **T36: Kiểm thử toàn bộ + review bảo mật + hiệu năng** (M)
  - Chạy toàn bộ E2E. Chạy `/review` và `security-and-hardening` (OWASP, `npm audit`, header bảo mật,
    CSP). Thêm rate-limit theo IP ở Nginx cho `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` (từ review ở
    Checkpoint B). Đánh giá nâng Prisma 7 để hết cảnh báo `deepmerge-ts` của Prisma CLI. Theo dõi log
    `uncaughtException: aborted (ECONNRESET)` khi client huỷ request: thấy ở T11, không làm sập server. Đo LCP và CLS trang Kiot, Chợ, trang chủ. Chạy checklist `/ship`.
  - Acceptance:
    - Không còn lỗi Critical/High.
    - LCP < 2,5 giây trên giả lập 4G.
    - Checklist `/ship` ra kết luận GO.
  - Verify: báo cáo `/ship`.
  - Deps: T35
  - Files: tuỳ theo phát hiện, cùng `docs/launch-checklist.md`
  - Kết quả: xem `docs/launch-checklist.md` (GO có điều kiện: hoàn thành T37). Phát hiện và đã sửa:
    trang Kiot lỗi 500 sau HTTPS nếu `HOSTNAME=127.0.0.1`; worker/CLI thiếu thư viện trong image Docker;
    bản sao lưu không khôi phục được (hàm tìm kiếm chưa ghi rõ schema); thanh trên tràn ngang ở 375px.

- [ ] **T37: Deploy VPS + thử tiền thật** (M)
  - Theo `docs/deploy.md`:
    - CEO chọn (24/10/2026): DNS chuyển về Cloudflare (để DNS only), certbot plugin Cloudflare tự gia hạn
      wildcard; VPS tự kéo code từ repo Private bằng deploy key chỉ đọc, cập nhật bằng `scripts/deploy.sh`
      (sao lưu DB trước migration, tự quay về bản cũ khi lỗi, `--rollback`).
    - Dữ liệu mẫu để CEO thử (26/10/2026, CEO duyệt kèm video): `scripts/seed-demo.ts` + `src/server/demo-data.ts`,
      chỉ dữ liệu hiển thị, không đụng sổ tiền; `--xoa` dọn sạch trước khi mở cửa.
    - Cài Docker, `.env`, Nginx, SSL wildcard.
    - Cron (reconcile 5 phút, tick 5 phút, payouts sync 2 phút, billing 8:00, digest 8:00, backup DB 2:00).
    - Đăng ký webhook PayOS, xác thực tên miền Brevo, tạo tài khoản CEO.
  - Acceptance:
    - `https://9mua.com` và `https://abc.9mua.com` có HTTPS.
    - Trả 2.000đ thật thì Kiot thử được kích hoạt.
    - Chi hộ 2.000đ thật tới được một tài khoản thử.
    - Backup DB khôi phục được.
  - Verify: CEO cùng kiểm theo checklist trong `docs/deploy.md`.
  - Deps: T36
  - Files: `docs/deploy.md`, `deploy/cron/9mua.cron`, `scripts/backup-db.sh`, `scripts/deploy.sh`

### ✅ Checkpoint I — Mở cửa
- [ ] CEO duyệt GO/NO-GO.
- [ ] Đã hỏi ý kiến pháp lý về thu hộ (rủi ro trong `tasks/plan.md`).

---

## Phase 10 — V4: giao diện, mạng xã hội, livestream (`docs/v4-merge-plan.md`, CEO duyệt 27/10/2026)

### Giai đoạn A — Giao diện (không đổi schema, không đụng sổ tiền trừ T46)
- [x] **T38: Gộp nhánh mô tả sản phẩm chia mục** (S) — review `claude/project-thread-dnygzz`, gộp vào `main`.
- [x] **T39: Thanh điều hướng 5 nút + header + logo tròn** (M) — điện thoại: Trang chủ · Chợ · ＋ Đăng video ·
  Giỏ · Tôi; máy tính giữ thanh trên. Logo vòng tròn trắng viền cam, không nhấp nháy. Thêm `lucide-react`.
  Cập nhật `docs/BRAND.md`.
- [x] **T40: Trang chủ là feed video** (M) — nền đen; chữ giới thiệu + link Chợ cho Google; chỉ tải trước video
  đầu; chưa có video thì hiện nội dung Chợ. Nội dung trang chủ cũ (Video hot, Kiot nổi bật…) chuyển vào `/cho`.
  Kiểm lại vuốt trên iPhone.
- [x] **T47: Giao diện V4 — khung chung** (M) — CEO chốt lấy V4 làm chuẩn (§7 mục 10–11). Sửa `docs/BRAND.md`
  trước. Màu V4 (nền `#0A0A0A`, cam `#FF6B00`, chữ trắng, viền 1px trắng 10%), font Be Vietnam Pro + Space Grotesk
  (tự host), logo 48px phát sáng nhấp nháy, header 64px (logo, slogan, tìm, giỏ), thanh dưới 64px
  Video · Chợ · Live · Kiot · Tôi, nút "Đăng video" lên góc màn hình Video. Ảnh so sánh với V4.
- [x] **T48: Đa ngôn ngữ — nền móng** (M) — viết `SPEC-i18n.md`, CEO duyệt. Từ điển 7 thứ tiếng, nút chọn ngôn ngữ
  trên header, dịch khung chung.
- [ ] **T58: Spec cho phần mới** — `SPEC-social.md`, `SPEC-ai.md`, bổ sung creator/identity/admin/billing/kiot/marketplace
  (CEO duyệt qua chat, §7 mục 14).
- [ ] **T59: Đăng nhập Google + popup mở tài khoản** (`SPEC-identity.md` bổ sung).
- [ ] **T60: Admin nhớ thiết bị 30 ngày + công cụ CEO** (ghim, slogan, pháp lý, luật Free/voucher).
- [ ] **T61: Module social** — follow, bình luận, lưu, hashtag, tim Kiot, giới hạn Free, voucher.
- [ ] **T62: Feed V4** (gộp T41) — tab Đang Follow, thả tim 2 chạm, thanh tiến độ, cột nút, bình luận, chia sẻ có QR.
- [ ] **T63: Story 24h + Duet**.
- [ ] **T64: Trang Kiot V4** (gộp T42) + Social Connect.
- [ ] **T65: Trang Tôi V4** (gộp T43) — Free/voucher/xu, Bộ sưu tập, lối tắt; cài đặt tài khoản sang `/tai-khoan/cai-dat`.
- [ ] **T66: Đổi giao diện + dịch các trang còn lại** — Chợ, sản phẩm, danh bạ Kiot, giỏ, đặt hàng, đơn mua, đăng nhập,
  Kiot của tôi, video, admin (chỉ tiếng Việt).
- [ ] **T67: AI Studio** (`SPEC-ai.md`).
- [ ] **T68: Giới thiệu & Pháp lý + chính sách** (gộp T44, T45) và **giá 1 USD + voucher** (gộp T46).
- [ ] **T49–T57: Livestream + xu** (`SPEC-live.md`, CEO duyệt 27/10) — chia nhỏ trong `tasks/plan.md` trước khi làm:
  MediaMTX + Nginx + xác thực; bảng dữ liệu + bắt đầu/kết thúc; trang phát (WHIP); trang xem (WHEP) + đếm người
  xem; chat + tim (SSE); ghim sản phẩm + `sourceLiveId`; báo cáo + `/admin/live`; sổ xu + thưởng + `/admin/xu`;
  E2E với MediaMTX thật.
- [ ] **Đổi giao diện V4 + dịch từng trang** (gộp với T41–T46): Chợ & sản phẩm; Kiot; giỏ, đặt hàng, đơn mua;
  đăng nhập & tài khoản; Kiot của tôi; video & creator; admin.
- [ ] **T41: Feed: thả tim 2 chạm + túi cam, thanh tiến độ, chia sẻ có QR** (S)
- [ ] **T42: Trang Kiot kiểu TikTok** (M) — tab Sản phẩm / Video, số sản phẩm, đã bán, chia sẻ có QR.
- [ ] **T43: Trang Tôi** (S) — trung tâm tài khoản: đơn mua, giỏ, thông báo, Kiot của tôi, video của tôi.
- [ ] **T44: Giới thiệu & Pháp lý + trang chính sách** (M) — không con dấu vẽ, không STK cá nhân. Nội dung chính
  sách: Claude viết nháp, CEO duyệt trước khi đăng.
- [ ] **T45: Slogan cố định + dải nhắc mở tài khoản không che trang** (S)
- [ ] **T46: Giá Kiot 1 USD/năm quy ra VNĐ** (M) — sửa `SPEC-billing.md` trước; cron tỷ giá Vietcombank, làm tròn
  1.000đ, giữ giá gần nhất khi lỗi, chặn lệch > 10%, QR cũ giữ giá.

### Giai đoạn B — Mạng xã hội (chỉ thêm bảng mới; viết spec trước). Livestream đã chuyển lên T49–T57
- [ ] Follow Kiot + tab "Đang follow" + thông báo video mới.
- [ ] Bình luận video (trả lời 1 cấp, ghim, báo cáo, chống spam).
- [ ] Lưu video/sản phẩm; trang hashtag; feed ưu tiên Kiot đang follow.

### Giai đoạn C — Công cụ CEO
- [ ] Ghim Kiot/video lên đầu, sửa slogan, sửa thông tin pháp lý (có nhật ký).

