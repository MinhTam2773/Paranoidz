import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { HOTLINE } from "@/lib/site";

// SEO (audit 2026-10-30): own description + canonical instead of the layout's generic one.
export const metadata: Metadata = {
  title: "Chính sách | Paranoidz",
  description:
    "Chính sách giao hàng SPX, đổi trả trong 7 ngày, thanh toán COD / VietQR, bảo mật và khiếu nại của Paranoidz.",
  alternates: { canonical: "/policy" },
};

const link = "text-text-primary underline underline-offset-4 hover:text-accent";

// Section ids match the footer's POLICY_LINKS anchors (lib/site.ts).
// Only content the shop owner has approved is published here.
const SECTIONS: { id: string; title: string; body: ReactNode[] }[] = [
  {
    id: "info",
    title: "Thông tin cửa hàng",
    body: [
      "HỘ KINH DOANH COOLSHIRTZ.",
      "Mã số doanh nghiệp: 042097005182. Mã số thuế: 042097005182.",
      "Địa chỉ: 57/41/17 Tô Hiệu, P. Phú Thạnh, TP. Hồ Chí Minh.",
      "Email: support@paranoidz.vn. Hotline: 0345 267 709. Zalo: zalo.me/0345267709.",
      "Website: paranoidz.vn. Người chịu trách nhiệm: chủ hộ kinh doanh COOLSHIRTZ.",
    ],
  },
  {
    id: "terms",
    title: "Điều kiện giao dịch chung",
    body: [
      "Quy trình đặt hàng: chọn sản phẩm, thêm vào giỏ, điền thông tin giao hàng, chọn phương thức vận chuyển và phương thức thanh toán, rồi xác nhận đặt hàng. Đơn hàng được xác nhận khi bạn nhận được mã đơn (PZ-…) và email xác nhận.",
      "Khách hàng có trách nhiệm cung cấp thông tin giao hàng chính xác và kiểm tra hàng khi nhận. Cửa hàng có trách nhiệm giao đúng sản phẩm, mẫu mã và size bạn đã đặt, và bảo mật thông tin của bạn theo mục Chính sách bảo mật bên dưới.",
      "Cửa hàng được tạm ngừng hoặc chấm dứt giao dịch khi thông tin giao hàng sai hoặc không liên hệ được, khi sản phẩm đã hết hàng, hoặc khi giao dịch vi phạm pháp luật.",
      "Khi xác nhận đặt hàng, bạn đồng ý với các điều khoản trên trang này.",
    ],
  },
  {
    id: "price",
    title: "Chính sách giá",
    body: [
      "Giá niêm yết trên website CHƯA bao gồm thuế giá trị gia tăng (VAT).",
      "Phí vận chuyển tính theo bảng giá SPX cho từng tỉnh/thành và hiển thị ở bước thanh toán, trước khi bạn đặt hàng.",
      "Tổng thanh toán của đơn hàng = tiền hàng + phí vận chuyển. Ngoài hai khoản này, cửa hàng không thu thêm bất kỳ khoản phí nào — không có phí thu hộ COD, không có phí phụ thu.",
    ],
  },
  {
    id: "shipping",
    title: "Chính sách giao hàng",
    body: [
      "Paranoidz giao hàng toàn quốc qua đơn vị vận chuyển SPX Express.",
      "Thanh toán khi nhận hàng (COD): bạn chỉ trả tiền khi nhận được hàng, và được kiểm tra hàng trước khi thanh toán.",
      "Phí giao hàng tính theo bảng giá SPX cho từng tỉnh/thành và hiển thị ở bước thanh toán, trước khi bạn đặt hàng.",
      <>
        Sau khi đặt hàng, bạn có thể theo dõi đơn tại trang{" "}
        <Link href="/order-lookup" className={link}>Tra cứu đơn hàng</Link> bằng mã đơn (PZ-…) và số điện thoại đặt hàng.
      </>,
    ],
  },
  {
    id: "returns",
    title: "Chính sách đổi trả",
    body: [
      "Bạn có thể yêu cầu đổi hoặc trả hàng trong vòng 7 ngày kể từ khi nhận hàng.",
      "Sản phẩm đổi/trả cần còn nguyên tem mác, chưa qua sử dụng, chưa giặt và còn đủ phụ kiện đi kèm.",
      "Hàng lỗi hoặc sai mẫu do cửa hàng: cửa hàng chịu toàn bộ phí vận chuyển đổi/trả và đổi hàng mới hoặc hoàn tiền cho bạn.",
      "Đổi theo ý khách (đổi size, đổi mẫu khác): bạn chịu phí vận chuyển phát sinh.",
      "Tiền hoàn được chuyển khoản trong 3–5 ngày làm việc sau khi cửa hàng nhận lại hàng.",
      "Trường hợp bạn từ chối nhận hàng: đơn hàng được hoàn về cửa hàng, cửa hàng sẽ liên hệ lại với bạn; nếu bạn đặt lại, bạn chịu phí vận chuyển phát sinh.",
      `Để yêu cầu đổi/trả, gọi hotline ${HOTLINE} hoặc email support@paranoidz.vn và cung cấp mã đơn hàng cùng video mở hộp đầy đủ. Khiếu nại về sản phẩm chỉ được tiếp nhận sau khi bạn đã nhận hàng và có đầy đủ video mở hộp — không có video, cửa hàng không tiếp nhận đổi trả về sản phẩm.`,
    ],
  },
  {
    id: "payment",
    title: "Chính sách thanh toán",
    body: [
      "Cửa hàng nhận hai phương thức thanh toán: thanh toán khi nhận hàng (COD) và chuyển khoản ngân hàng qua mã VietQR.",
      "Đơn chuyển khoản được giao sau khi cửa hàng xác nhận đã nhận tiền. Khi đặt hàng bằng chuyển khoản, bạn sẽ nhận mã QR với đúng số tiền và nội dung là mã đơn — chuyển đúng số tiền và nội dung mã đơn để cửa hàng đối soát nhanh.",
      "Cửa hàng không thu thêm bất kỳ khoản phí thanh toán nào ngoài tiền hàng và phí vận chuyển đã hiển thị.",
    ],
  },
  {
    id: "privacy",
    title: "Chính sách bảo mật",
    body: [
      "Mục đích và phạm vi thu thập: khi đặt hàng, chúng tôi thu thập họ tên, số điện thoại, địa chỉ giao hàng và email (nếu bạn cung cấp). Khi bạn tạo tài khoản, chúng tôi lưu thêm email đăng nhập và các địa chỉ bạn đã lưu. Trang web dùng cookie và bộ nhớ trình duyệt để giữ đăng nhập, giỏ hàng và danh sách yêu thích.",
      "Phạm vi sử dụng: thông tin chỉ dùng để xử lý, giao đơn hàng, liên hệ với bạn về đơn hàng và chăm sóc khách hàng.",
      "Thời hạn lưu trữ: dữ liệu đơn hàng được lưu ít nhất 1 năm; dữ liệu tài khoản được lưu cho tới khi bạn yêu cầu xóa.",
      "Tổ chức, cá nhân có thể tiếp cận: nhân viên xử lý đơn hàng của cửa hàng và đơn vị vận chuyển SPX (chỉ thông tin cần để giao hàng).",
      "Biện pháp bảo đảm an toàn: quyền truy cập dữ liệu bị hạn chế cho người xử lý đơn hàng; thông tin của bạn không được công khai.",
      "Cách xem, sửa dữ liệu: gọi hotline 0345 267 709 hoặc email support@paranoidz.vn.",
      "Cách yêu cầu xóa, hủy hoặc hạn chế xử lý dữ liệu: gọi hotline 0345 267 709 hoặc email support@paranoidz.vn.",
      "Cách tiếp nhận và giải quyết khiếu nại về bảo mật: gửi về support@paranoidz.vn hoặc hotline 0345 267 709, xử lý theo mục Khiếu nại bên dưới.",
    ],
  },
  {
    id: "complaints",
    title: "Khiếu nại",
    body: [
      "Kênh tiếp nhận khiếu nại: email support@paranoidz.vn, hotline 0345 267 709, Zalo zalo.me/0345267709.",
      "Quy trình: tiếp nhận khiếu nại → xác minh → trả lời → xử lý theo kết quả xác minh.",
      "Khiếu nại về sản phẩm (sai mẫu, lỗi, thiếu hàng) chỉ được tiếp nhận sau khi bạn đã nhận hàng và có đầy đủ video mở hộp — không có video, cửa hàng không tiếp nhận khiếu nại về sản phẩm.",
      "Hỏi về vận chuyển hoặc tra cứu đơn hàng vẫn liên hệ bình thường qua các kênh trên, không cần video mở hộp.",
    ],
  },
  {
    id: "retention",
    title: "Lưu trữ thông tin",
    body: [
      "Thông tin hàng hóa trên website được duy trì để khách hàng truy cập ít nhất 1 năm.",
      "Dữ liệu hợp đồng của hộ kinh doanh được lưu trữ ít nhất 1 năm.",
    ],
  },
];

export default function PolicyPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Chính sách" }]} />
      <h1 className="mb-8 text-h2 uppercase">Chính sách</h1>
      <div className="flex max-w-3xl flex-col gap-12">
        {SECTIONS.map(({ id, title, body }) => (
          // scroll-mt clears the sticky header (64px mobile, 112px with the desktop nav row)
          <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 lg:scroll-mt-32">
            <h2 id={`${id}-title`} className="mb-4 border-l-4 border-accent pl-3 text-h3 uppercase">{title}</h2>
            <div className="flex flex-col gap-3 text-body text-text-secondary">
              {body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
