# Chuyển storefront (paranoidz.vn) từ Vercel sang Cloudflare Workers

> Lý do (2026-11-10): gói Vercel Hobby đã vượt hạn mức — ISR Writes 217K / 200K, Image
> Transformations 5K / 5K, Active CPU 3h 3m / 4h. Vercel có thể tạm dừng project.
> Code đã sẵn sàng (OpenNext, `apps/storefront/wrangler.jsonc`, `open-next.config.ts`).
> Phần dưới là các bước **chủ tài khoản Cloudflare phải tự làm** trên dashboard.
> Admin (`admin.paranoidz.vn`) vẫn ở Vercel, không đổi gì.

## Cái gì chạy ở đâu sau khi chuyển

| Trên Vercel | Trên Cloudflare |
| ----------- | --------------- |
| Project `paranoidz` (storefront) | Worker `paranoidz-storefront` |
| ISR cache | R2 bucket `paranoidz-storefront-cache` (riêng tư) + 2 Durable Object (tự tạo khi deploy) |
| Functions vùng `sin1` | Smart Placement (Worker tự chạy gần Supabase Singapore) |
| Environment Variables (Production) | Build variables + Variables and Secrets của Worker |
| Deploy khi merge vào `master` | Workers Builds, nhánh `master` |
| Preview cho mỗi PR | **Không có** (xem "Chưa làm") |

## Chi phí

- **Workers Free:** 100.000 request / ngày, **10 ms CPU mỗi request**, script tối đa 3 MB (gzip).
  Bản build hiện tại nặng 2,4 MB gzip nên vừa. Rủi ro là giới hạn 10 ms CPU: các trang render
  trên server (thanh toán, tìm kiếm, tài khoản, lúc ISR dựng lại trang) có thể vượt và trả lỗi 1102.
- **Workers Paid (khoảng 5 USD / tháng, xem lại trang giá của Cloudflare):** bỏ giới hạn 10 ms, script
  tới 10 MB. Nên dùng gói này cho shop đang chạy quảng cáo.
- Cách quyết định: deploy lên Free trước (bước 3), xem cột CPU time và lỗi trong Worker → Metrics.
  Nếu có lỗi 1102 hoặc CPU sát 10 ms thì nâng lên Paid **trước khi** đổi tên miền.

## Bước 1 — Tạo R2 bucket cho cache

Cloudflare dashboard → R2 → Create bucket: tên `paranoidz-storefront-cache`, vị trí Asia-Pacific.
**Không** bật public access, **không** gắn tên miền (khác với `paranoidz-media`).

## Bước 2 — Tạo Worker từ repo GitHub

Workers & Pages → Create → Import a repository → `MinhTam2773/Paranoidz`.

| Mục | Giá trị |
| --- | ------- |
| Project name | `paranoidz-storefront` (phải đúng tên này, trùng `wrangler.jsonc`) |
| Production branch | `master` |
| Root directory | `apps/storefront` |
| Build command | `npx -y pnpm@11.13.1 install --frozen-lockfile && npx -y pnpm@11.13.1 cf:build` |
| Deploy command | `npx -y pnpm@11.13.1 cf:deploy` |
| Builds for non-production branches | **Tắt** |

**Build variables** (Settings → Build → Variables and secrets). Giá trị lấy từ Vercel → project
storefront → Environment Variables → Production:

| Biến | Giá trị |
| ---- | ------- |
| `NODE_VERSION` | `22` |
| `SKIP_DEPENDENCY_INSTALL` | `1` (build command tự cài bằng pnpm 11) |
| `NEXT_PUBLIC_DEPLOY_ENV` | `production` — **thiếu biến này thì Meta pixel và Google tag tắt** |
| `NEXT_PUBLIC_SUPABASE_URL` | như Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | như Vercel |
| `NEXT_PUBLIC_MEDIA_URL` | `https://media.paranoidz.vn` |
| `NEXT_PUBLIC_SENTRY_DSN` | như Vercel |
| `NEXT_PUBLIC_POSTHOG_KEY` (+ `NEXT_PUBLIC_POSTHOG_HOST` nếu có) | như Vercel |

**Variables and Secrets lúc chạy** (Settings → Variables and Secrets), chọn loại **Secret**:

- Tất cả biến `NEXT_PUBLIC_*` ở bảng trên (nhập lại lần nữa ở đây).
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ORDER_ALERT_EMAIL`, `ZALO_BOT_TOKEN`,
  `ZALO_OWNER_CHAT_ID`, `META_CAPI_TOKEN`, `REVALIDATE_SECRET` (cùng giá trị với admin).
- `SPX_API_HOST`, `SPX_APP_ID`, `SPX_APP_SECRET`, `SPX_USER_ID`, `SPX_USER_SECRET`,
  `SPX_SENDER_WARD`, `SPX_SENDER_PROVINCE`.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- **Không** nhập `TEST_LABEL`, `SITE_URL`, `ADMIN_URL` (chỉ dùng cho môi trường test).

⚠️ Không dán secret vào chat hay commit vào git. Thiếu `SPX_*` thì checkout lặng lẽ dùng bảng giá chuẩn;
thiếu `META_CAPI_TOKEN` thì không gửi Purchase từ server.

## Bước 3 — Deploy thử và kiểm tra trên `workers.dev`

Bấm Deploy. Worker chạy ở `https://paranoidz-storefront.<tài-khoản>.workers.dev`, **dùng database thật**,
và `paranoidz.vn` vẫn đang ở Vercel. Kiểm tra (đừng đặt đơn thật ở bước này):

1. Trang chủ, một trang sản phẩm, `/products`, một bộ sưu tập: có ảnh, giá, tồn kho.
2. Tải lại trang chủ: header phản hồi có `x-opennext-cache: HIT`.
3. Giỏ hàng → thanh toán: nhập địa chỉ, thẻ SPX hiện **"Giá trực tiếp từ SPX"** (không bấm đặt hàng).
4. Tra cứu đơn hàng với một đơn cũ; đăng nhập / đăng xuất.
5. DevTools → Console trên trang chủ: `typeof fbq` và `typeof gtag` đều ra `"function"` (pixel đang bật).
6. Worker → Metrics: không có lỗi, xem CPU time (mục "Chi phí").

## Bước 4 — Đổi tên miền (vài phút, làm lúc vắng khách)

1. DNS → Records của `paranoidz.vn`: **chụp lại** bản ghi `paranoidz.vn` (và `www` nếu có) đang trỏ về
   Vercel để có thể quay lại. Không đụng tới MX / TXT (email) và `admin`, `media`.
2. Xoá bản ghi `paranoidz.vn` (và `www`) trỏ về Vercel.
3. Worker `paranoidz-storefront` → Settings → Domains & Routes → Add → Custom Domain → `paranoidz.vn`
   (thêm `www.paranoidz.vn` nếu trước đây có).

## Bước 5 — Kiểm tra sau khi đổi

1. `https://paranoidz.vn` mở được, làm lại 6 mục ở bước 3 trên tên miền thật.
2. Sửa một sản phẩm trong admin → tải lại trang đó trên storefront, thấy thay đổi (admin gọi
   `/api/revalidate`). Nếu không thấy: xem log của project admin trên Vercel, dòng `storefront revalidate failed`.
3. `https://paranoidz.vn/meta-feed.xml` và `/sitemap.xml` trả dữ liệu.
4. Đặt **một đơn thử** rồi huỷ trong admin: có email, có tin Zalo, Events Manager nhận Purchase
   từ cả trình duyệt và server.
5. Đơn SPX kế tiếp tự chuyển trạng thái (webhook `/api/spx/webhook`).
6. Nếu bật Bot Fight Mode (Security → Bots): nó có thể chặn các lời gọi máy-với-máy ở mục 2, 3, 5.
   Thấy lỗi 403 ở các đường đó thì tắt.

## Quay lại Vercel (nếu có sự cố)

Worker → Domains & Routes → gỡ `paranoidz.vn`, rồi tạo lại bản ghi DNS đã chụp ở bước 4. Project
storefront trên Vercel vẫn còn nguyên và vẫn build `master`, nên quay lại chỉ là đổi DNS.

## Sau khi chạy ổn khoảng một tuần

- Vercel: ngắt Git hoặc xoá project storefront (giữ project admin).
- Báo cho developer để dọn code: xoá `apps/storefront/vercel.json`, bỏ nhánh `process.env.VERCEL`
  trong `src/lib/rate-limit.ts`, thêm `"workers_dev": false` và `routes` vào `wrangler.jsonc`.
- Luật merge: PR chỉ còn check CI `test` + check của Vercel cho admin (+ Workers Builds).

## Chưa làm

- **Preview cho PR storefront.** Bản build nhánh khác của Workers Builds dùng chung secret và database
  thật với production, nên đang tắt. Muốn có preview trỏ vào `paranoidz-test`: thêm một
  `env.preview` trong `wrangler.jsonc` với Worker và secret riêng.
- **Admin vẫn ở Vercel Hobby.** Sau khi storefront rời đi, mức dùng còn lại rất thấp, nhưng điều khoản
  "Hobby không dùng cho thương mại" vẫn áp dụng (`docs/BACKLOG.md`).
- **Tối ưu ảnh** vẫn tắt (`unoptimized: true`), như trên Vercel.
