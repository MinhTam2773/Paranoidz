"use client";

import { useState } from "react";

// FAQ 2026-10-16: accordion câu hỏi thường gặp. Nội dung soạn theo mẫu
// Hydra + chính sách shop; Tủn duyệt/sửa nội dung khi cần.
const FAQS: { q: string; a: string }[] = [
  {
    q: "Mất bao lâu để giao hàng?",
    a: "Shop giao qua SPX Express. Nội thành TP.HCM: 1–2 ngày. Tỉnh thành khác: 2–5 ngày làm việc. Sau khi gửi hàng, shop sẽ nhắn mã vận đơn để bạn tự tra cứu tiến trình.",
  },
  {
    q: "Làm sao để biết size nào vừa với mình?",
    a: "Mỗi sản phẩm đều có bảng size theo cân nặng và số đo chi tiết ở phần mô tả. Nếu vẫn phân vân, nhắn hotline 0345 267 709 để shop tư vấn.",
  },
  {
    q: "Mua rồi không vừa, trả hàng được không?",
    a: "Được, trong 7 ngày kể từ khi nhận, hàng chưa giặt, chưa dùng, còn nguyên tem mác và phụ kiện. Vào Tra cứu đơn hàng để gửi yêu cầu. Shop gửi SPX đến lấy và chịu phí vận chuyển trả hàng. Tiền hoàn là tiền hàng (sau giảm giá), không gồm phí ship lúc gửi đi, chuyển khoản trong 3–5 ngày làm việc sau khi shop nhận lại hàng.",
  },
  {
    q: "Đổi size hoặc đổi mẫu khác được không?",
    a: "Được, trong 7 ngày, hàng còn nguyên điều kiện trên. Liên hệ hotline 0345 267 709 hoặc support@paranoidz.vn. Khách chịu phí vận chuyển phát sinh.",
  },
  {
    q: "Có hỗ trợ COD (nhận hàng trả tiền) không?",
    a: "Có. Bạn được kiểm tra hàng trước khi thanh toán cho shipper. Ngoài COD, shop còn nhận chuyển khoản qua mã VietQR — đơn chuyển khoản được giao sau khi shop xác nhận đã nhận tiền.",
  },
  {
    q: "Làm sao kiểm tra tình trạng đơn hàng?",
    a: "Bạn vào mục Tra cứu đơn hàng ở menu, nhập mã đơn + số điện thoại để xem trạng thái giao hàng theo thời gian thực từ SPX.",
  },
  {
    q: "Hàng local brand này sản xuất ở đâu?",
    a: "100% sản xuất tại Việt Nam — từ vải, cắt may đến thêu họa tiết đều làm trong nước.",
  },
  {
    q: "Có giảm giá hay ưu đãi cho khách quen không?",
    a: "Có. Shop có chương trình Flash Sale mỗi ngày với giá giảm thêm, và ưu đãi riêng cho khách mua lại. Theo dõi fanpage để không bỏ lỡ.",
  },
  {
    q: "Sản phẩm có bị phai màu hay co rút khi giặt không?",
    a: "Vải đã qua xử lý co rút và giữ màu trước khi may. Bạn giặt máy chế độ nhẹ, lộn trái áo và phơi trong mát để áo bền đẹp lâu nhất.",
  },
  {
    q: "Tôi đặt nhầm thông tin (sai size, sai địa chỉ), phải làm sao?",
    a: "Gọi ngay hotline 0345 267 709 — nếu đơn chưa giao cho SPX, shop sẽ sửa miễn phí cho bạn.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section aria-label="Câu hỏi thường gặp">
      <h2 className="text-center text-h2 uppercase lg:text-h1">
        Bạn có câu hỏi gì
        <br />
        hãy để chúng tôi giải đáp
      </h2>
      <div className="mx-auto mt-8 max-w-3xl">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-nav font-bold">{f.q}</span>
                <span
                  aria-hidden
                  className={`shrink-0 text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                  ⌄
                </span>
              </button>
              <div
                className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <p className="overflow-hidden text-body text-text-secondary">{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
