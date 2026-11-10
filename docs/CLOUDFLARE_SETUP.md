# Chuyển storefront (paranoidz.vn) từ Vercel sang Cloudflare Workers

> Lý do (2026-11-10): gói Vercel Hobby đã vượt hạn mức — ISR Writes 217K / 200K, Image
> Transformations 5K / 5K, Active CPU 3h 3m / 4h. Vercel có thể tạm dừng project.
> Code: PR #96 (storefront), nằm trên PR #95 (Next 16.4.5 + admin). Kế hoạch chung và phần admin:
> `TODO.md` Now #13. Gói Workers Paid đã mua.

## Đã xong

- R2 bucket `paranoidz-storefront-cache` (cache ISR, riêng tư).
- Worker `paranoidz-storefront`, nối với repo qua Workers Builds:

| Mục | Giá trị |
| --- | ------- |
| Root directory | `apps/storefront` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Production branch | `claude/lucid-meitner-m4bzh1` (đổi sang `master` sau khi merge PR #96) |
| Build nhánh khác (preview) | không có — bản preview sẽ dùng chung secret của Worker |
| Build variables đã nhập | `NEXT_PUBLIC_DEPLOY_ENV=preview`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` (database **test**) |
| Secrets lúc chạy đã nhập | 3 biến `NEXT_PUBLIC_*` trên, `TEST_LABEL`, `SITE_URL`, `ADMIN_URL`, `ORDER_ALERT_EMAIL` (chép từ bộ Preview của Vercel) |

**Đã deploy bản chạy thử** (2026-11-10): `https://paranoidz-storefront.tamnguyen277353.workers.dev`, dùng database test.
Xem trang, sản phẩm, bộ sưu tập, cache, tra cứu đơn và đặt hàng đều chạy (đơn thử PZ-2026-0069 trong database test).
Phí ship đang theo bảng giá chuẩn, chưa có email / Zalo: thiếu `SPX_*`, `RESEND_API_KEY`, `ZALO_*`
(Vercel đánh dấu Sensitive nên không đọc lại được).

Không cần `SKIP_DEPENDENCY_INSTALL` hay lệnh `pnpm install`: Workers Builds tự cài cả workspace bằng pnpm.

## Bước 1 — Hoàn tất bản chạy thử (database test)

Còn thiếu các secret Vercel không cho đọc lại. **Không dán secret vào chat.** Hai cách nhập:

- Từ máy có `apps/storefront/.env.local`, trong thư mục `apps/storefront`:
  `npx wrangler@4.158.0 secret bulk .env.local --name paranoidz-storefront` (đẩy cả file lên làm secret).
- Hoặc nhập tay ở Worker → Settings → Variables and Secrets, loại **Secret**:
  `SPX_API_HOST`, `SPX_APP_ID`, `SPX_APP_SECRET`, `SPX_USER_ID`, `SPX_USER_SECRET`,
  `SPX_SENDER_WARD`, `SPX_SENDER_PROVINCE` (thiếu `SPX_*` thì phí ship lấy theo bảng giá chuẩn).

Sau đó kiểm tra trên bản chạy thử:
   - Trang chủ, `/products`, một trang sản phẩm, một bộ sưu tập: có ảnh, giá, tồn kho (dữ liệu test).
   - Tải lại trang chủ: header phản hồi có `x-opennext-cache: HIT`.
   - Giỏ hàng → thanh toán: nhập địa chỉ, có phí ship; đặt một đơn (vào database test).
   - Tra cứu đơn vừa đặt; đăng ký / đăng nhập / đăng xuất.
   - Worker → Observability: không có lỗi; xem CPU time của các request.

## Bước 2 — Đổi sang giá trị production

Giá trị lấy từ Vercel → project storefront → Environment Variables → Production.

1. **Build variables:** sửa `NEXT_PUBLIC_DEPLOY_ENV` thành `production` (**thiếu thì Meta pixel và
   Google tag tắt**), `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` thành của
   production; thêm `NEXT_PUBLIC_MEDIA_URL` (`https://media.paranoidz.vn`), `NEXT_PUBLIC_SENTRY_DSN`,
   `NEXT_PUBLIC_POSTHOG_KEY` (+ `NEXT_PUBLIC_POSTHOG_HOST` nếu có).
2. **Secrets lúc chạy:** thay toàn bộ bằng giá trị production; nhập thêm các `NEXT_PUBLIC_*` ở mục 1,
   `RESEND_API_KEY`, `ORDER_ALERT_EMAIL`, `ZALO_BOT_TOKEN`, `ZALO_OWNER_CHAT_ID`, `META_CAPI_TOKEN`,
   `REVALIDATE_SECRET` (cùng giá trị với admin), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. **Xoá `TEST_LABEL`.**
   Thiếu `SPX_*` thì checkout lặng lẽ dùng bảng giá chuẩn; thiếu `META_CAPI_TOKEN` thì không gửi Purchase từ server.
3. Merge PR #96, đổi Production branch sang `master`, build lại.
4. Kiểm tra lại trên `workers.dev` (lúc này là dữ liệu thật — **đừng đặt đơn**): ảnh từ
   `media.paranoidz.vn`, thẻ SPX hiện "Giá trực tiếp từ SPX", DevTools → Console: `typeof fbq` và
   `typeof gtag` đều ra `"function"`.

## Bước 3 — Đổi tên miền (vài phút, làm lúc vắng khách)

1. DNS → Records của `paranoidz.vn`: **chụp lại** bản ghi `paranoidz.vn` (và `www` nếu có) đang trỏ về
   Vercel để có thể quay lại. Không đụng tới MX / TXT (email) và `admin`, `media`.
2. Xoá bản ghi `paranoidz.vn` (và `www`) trỏ về Vercel.
3. Worker `paranoidz-storefront` → Settings → Domains & Routes → Add → Custom Domain → `paranoidz.vn`,
   rồi thêm `www.paranoidz.vn` (Vercel đang phục vụ cả hai).

## Bước 4 — Kiểm tra sau khi đổi

1. `https://paranoidz.vn` mở được; làm lại mục 4 của bước 2 trên tên miền thật.
2. Sửa một sản phẩm trong admin → tải lại trang đó trên storefront, thấy thay đổi (admin gọi
   `/api/revalidate`). Nếu không thấy: xem log của admin, dòng `storefront revalidate failed`.
3. `https://paranoidz.vn/meta-feed.xml` và `/sitemap.xml` trả dữ liệu.
4. Đặt **một đơn thử** rồi huỷ trong admin: có email, có tin Zalo, Events Manager nhận Purchase
   từ cả trình duyệt và server.
5. Đơn SPX kế tiếp tự chuyển trạng thái (webhook `/api/spx/webhook`).
6. Nếu bật Bot Fight Mode (Security → Bots): nó có thể chặn các lời gọi máy-với-máy ở mục 2, 3, 5.
   Thấy lỗi 403 ở các đường đó thì tắt.

## Quay lại Vercel (nếu có sự cố)

Worker → Domains & Routes → gỡ `paranoidz.vn`, rồi tạo lại bản ghi DNS đã chụp ở bước 3. Project
storefront trên Vercel vẫn còn nguyên và vẫn build `master`, nên quay lại chỉ là đổi DNS.

## Sau khi chạy ổn khoảng một tuần

- Vercel: ngắt Git hoặc xoá project storefront.
- Dọn code: xoá `apps/storefront/vercel.json`, bỏ nhánh `process.env.VERCEL` trong
  `src/lib/rate-limit.ts`, thêm `"workers_dev": false` và `routes` vào `wrangler.jsonc`.
- Luật merge: thay "3 check của Vercel" (`TODO.md`).

## Chưa làm

- **Preview cho PR storefront.** Cần một `env.preview` trong `wrangler.jsonc` với Worker và secret riêng
  trỏ vào `paranoidz-test`.
- **Tối ưu ảnh** vẫn tắt (`unoptimized: true`), như trên Vercel.
