# Cấu hình SPX trên Vercel — để giá ship SPX trực tiếp hiện ở trang thanh toán

> Code tích hợp SPX đã có sẵn trong repo (tính giá live + voucher, fallback bảng giá).
> Nhưng nếu thiếu env vars dưới đây, checkout sẽ **lặng lẽ dùng bảng giá chuẩn** —
> khách vẫn thấy phí ship, nhưng không phải giá SPX trực tiếp.

## Thêm env vars vào Vercel

Vercel Dashboard → project `paranoidz` (storefront) → Settings → Environment Variables.
Thêm cho cả 3 môi trường (Production, Preview, Development), rồi **Redeploy**:

| Biến | Lấy ở đâu |
| ---- | --------- |
| `SPX_API_HOST` | Host SPX Open API, ví dụ `https://open.spx.vn` (test: `https://test-stable.spx.vn`) |
| `SPX_APP_ID` | SPX cấp khi đăng ký integration |
| `SPX_APP_SECRET` | SPX cấp cùng App ID — **giữ kín** |
| `SPX_USER_ID` | ID tài khoản người bán SPX của shop (số, 15 chữ số) |
| `SPX_USER_SECRET` | Secret của tài khoản người bán — **giữ kín** |
| `SPX_SENDER_PROVINCE` | Tên tỉnh/thành kho gửi hàng theo danh mục SPX (vd `Hồ Chí Minh`) |
| `SPX_SENDER_WARD` | Tên phường/xã kho gửi hàng theo danh mục SPX |

⚠️ Tất cả đều là **server-only** — không bao giờ thêm tiền tố `NEXT_PUBLIC_`,
không commit vào git.

## Kiểm tra đã chạy đúng chưa

1. Vào trang thanh toán, nhập địa chỉ giao hàng (tỉnh + phường/xã).
2. Thẻ **SPX Express** hiện phí ship kèm dòng **"Giá trực tiếp từ SPX"**
   → SPX đang chạy live. ✅
3. Nếu chỉ thấy **"Theo bảng giá chuẩn"** → kiểm tra lại env vars và redeploy.
   (SPX lỗi/timeout quá 3 giây cũng fallback về bảng giá để checkout không bị kẹt.)

## Lưu ý vận hành

- Giá SPX có thể kèm **voucher khuyến mãi của tài khoản** — code tự lấy voucher
  còn hiệu lực rẻ nhất, không cần nhập tay.
- Phí khách thấy lúc thanh toán = phí đơn hàng bị tính (cache 5 phút).
- Tạo đơn SPX / in phiếu vẫn làm trong **trang admin** (nút "Tạo đơn SPX"),
  không phải việc của trang thanh toán.
